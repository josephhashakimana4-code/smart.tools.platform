const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const multer = require("multer");
const mammoth = require("mammoth");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { PDFParse } = require("pdf-parse");
const Tool = require("../models/Tool");
const ConvertedFile = require("../models/ConvertedFile");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const { getFallbackTools, getFallbackToolBySlug } = require("../config/fallbackTools");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

const convertedDir = path.join(__dirname, "..", "converted");
if (!fs.existsSync(convertedDir)) {
  fs.mkdirSync(convertedDir, { recursive: true });
}

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const wordConverterScript = path.join(__dirname, "..", "scripts", "convert-with-word.ps1");

const slugAliases = {
  percentagecalculator: "percentage-calculator",
  bmi: "bmi-calculator",
  age: "age-calculator",
  unitconverter: "unit-converter",
  pdfword: "pdf-to-word",
  pdftoword: "pdf-to-word",
  wordtopdf: "word-to-pdf",
  mergepdf: "merge-pdf",
  splitpdf: "split-pdf",
  pdfcompressor: "pdf-compressor",
  qrcode: "qr-code-generator",
  qrgenerator: "qr-code-generator",
  password: "password-generator",
  wordcounter: "word-counter",
  charactercounter: "character-counter"
};

function normalizeSlug(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.html$/i, "")
    .replace(/&.*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const compact = raw.replace(/-/g, "");
  return slugAliases[raw] || slugAliases[compact] || raw;
}

async function createDownload(req, options) {
  const stat = fs.statSync(options.path);
  const file = await ConvertedFile.create({
    toolSlug: options.toolSlug,
    originalName: options.originalName,
    filename: options.filename,
    path: options.path,
    mimeType: options.mimeType,
    size: stat.size
  });

  return {
    id: file._id,
    filename: options.filename,
    size: stat.size,
    downloadUrl: `${req.protocol}://${req.get("host")}/api/tools/download/${file._id}`,
    directUrl: `${req.protocol}://${req.get("host")}/download/${options.filename}`
  };
}

function safeName(prefix, ext) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
}

function safeOriginalExt(filename, fallback) {
  const ext = path.extname(filename || "").replace(".", "").toLowerCase();
  return ext || fallback;
}

function convertWithWord(inputPath, outputPath, outputType) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        wordConverterScript,
        "-InputPath",
        inputPath,
        "-OutputPath",
        outputPath,
        "-OutputType",
        outputType
      ],
      { timeout: 120000, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          error.message = `${error.message}\n${stderr || stdout || ""}`;
          reject(error);
          return;
        }

        resolve();
      }
    );
  });
}

function wrapText(text, maxLength = 88) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    if ((line + " " + word).trim().length > maxLength) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  const data = await parser.getText();
  await parser.destroy?.();
  return data.text || "";
}

async function writeTextPdf(text, outputPath, title = "Converted Document") {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const fontSize = 11;
  const lineHeight = 15;
  let page = pdfDoc.addPage();
  let y = page.getHeight() - margin;

  page.drawText(title, {
    x: margin,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.16, 0.24)
  });
  y -= 30;

  for (const paragraph of String(text || "").split(/\n+/)) {
    for (const line of wrapText(paragraph)) {
      if (y < margin) {
        page = pdfDoc.addPage();
        y = page.getHeight() - margin;
      }

      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.1, 0.1, 0.1)
      });
      y -= lineHeight;
    }
    y -= 8;
  }

  fs.writeFileSync(outputPath, await pdfDoc.save({ useObjectStreams: true }));
}

router.post("/pdf-to-word", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a PDF file." });
    }

    const mode = "fast";
    const filename = safeName("pdf-to-word", "docx");
    const outputPath = path.join(convertedDir, filename);

    if (mode === "fast") {
      const text = await extractPdfText(req.file.buffer);
      if (!text.trim()) {
        return res.status(422).json({
          success: false,
          message: "No selectable text was found in this PDF. Scanned image PDFs need OCR."
        });
      }

      const doc = new Document({
        sections: [{
          children: text.split(/\n+/).map((line) => new Paragraph({
            children: [new TextRun(line || " ")]
          }))
        }]
      });

      fs.writeFileSync(outputPath, await Packer.toBuffer(doc));
    } else {
      const inputPath = path.join(uploadsDir, safeName("source-pdf", "pdf"));
      fs.writeFileSync(inputPath, req.file.buffer);

      try {
        await convertWithWord(inputPath, outputPath, "docx");
      } catch (wordErr) {
        console.error("Word PDF to DOCX fallback:", wordErr);
        const text = await extractPdfText(req.file.buffer);
        if (!text.trim()) {
          return res.status(422).json({
            success: false,
            message: "No selectable text was found in this PDF. Scanned image PDFs need OCR."
          });
        }

        const doc = new Document({
          sections: [{
            children: text.split(/\n+/).map((line) => new Paragraph({
              children: [new TextRun(line || " ")]
            }))
          }]
        });

        fs.writeFileSync(outputPath, await Packer.toBuffer(doc));
      } finally {
        fs.rmSync(inputPath, { force: true });
      }
    }

    const download = await createDownload(req, {
      toolSlug: "pdf-to-word",
      originalName: req.file.originalname,
      filename,
      path: outputPath,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

    res.json({ success: true, ...download });
  } catch (err) {
    console.error("PDF to Word error:", err);
    res.status(500).json({ success: false, message: "Failed to convert PDF to Word." });
  }
});

router.post("/word-to-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a Word document." });
    }

    const inputExt = safeOriginalExt(req.file.originalname, "docx");
    const inputPath = path.join(uploadsDir, safeName("source-word", inputExt));
    const filename = safeName("word-to-pdf", "pdf");
    const outputPath = path.join(convertedDir, filename);
    fs.writeFileSync(inputPath, req.file.buffer);

    try {
      await convertWithWord(inputPath, outputPath, "pdf");
    } catch (wordErr) {
      console.error("Word to PDF fallback:", wordErr);
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      const text = result.value || "";
      if (!text.trim()) {
        return res.status(422).json({ success: false, message: "No text was found in this Word document." });
      }

      await writeTextPdf(text, outputPath, "Word to PDF");
    } finally {
      fs.rmSync(inputPath, { force: true });
    }

    const download = await createDownload(req, {
      toolSlug: "word-to-pdf",
      originalName: req.file.originalname,
      filename,
      path: outputPath,
      mimeType: "application/pdf"
    });
    res.json({ success: true, ...download });
  } catch (err) {
    console.error("Word to PDF error:", err);
    res.status(500).json({ success: false, message: "Failed to convert Word to PDF." });
  }
});

router.post("/merge-pdf", upload.array("files", 20), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ success: false, message: "Please upload at least two PDF files." });
    }

    const merged = await PDFDocument.create();
    for (const file of req.files) {
      const source = await PDFDocument.load(file.buffer);
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }

    const filename = safeName("merged-pdf", "pdf");
    const outputPath = path.join(convertedDir, filename);
    fs.writeFileSync(outputPath, await merged.save({ useObjectStreams: true }));
    const download = await createDownload(req, {
      toolSlug: "merge-pdf",
      originalName: req.files.map((file) => file.originalname).join(", "),
      filename,
      path: outputPath,
      mimeType: "application/pdf"
    });
    res.json({ success: true, ...download });
  } catch (err) {
    console.error("Merge PDF error:", err);
    res.status(500).json({ success: false, message: "Failed to merge PDF files." });
  }
});

router.post("/split-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a PDF file." });
    }

    const source = await PDFDocument.load(req.file.buffer);
    const totalPages = source.getPageCount();
    const pageNumber = Math.min(Math.max(Number(req.body.page || 1), 1), totalPages);
    const output = await PDFDocument.create();
    const [page] = await output.copyPages(source, [pageNumber - 1]);
    output.addPage(page);

    const filename = safeName(`split-page-${pageNumber}`, "pdf");
    const outputPath = path.join(convertedDir, filename);
    fs.writeFileSync(outputPath, await output.save({ useObjectStreams: true }));
    const download = await createDownload(req, {
      toolSlug: "split-pdf",
      originalName: req.file.originalname,
      filename,
      path: outputPath,
      mimeType: "application/pdf"
    });
    res.json({ success: true, ...download, totalPages });
  } catch (err) {
    console.error("Split PDF error:", err);
    res.status(500).json({ success: false, message: "Failed to split PDF." });
  }
});

router.post("/pdf-compressor", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a PDF file." });
    }

    const pdfDoc = await PDFDocument.load(req.file.buffer);
    const filename = safeName("compressed-pdf", "pdf");
    const output = await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false });
    const outputPath = path.join(convertedDir, filename);
    fs.writeFileSync(outputPath, output);
    const download = await createDownload(req, {
      toolSlug: "pdf-compressor",
      originalName: req.file.originalname,
      filename,
      path: outputPath,
      mimeType: "application/pdf"
    });

    res.json({
      success: true,
      ...download,
      originalSize: req.file.size,
      compressedSize: output.length
    });
  } catch (err) {
    console.error("PDF compressor error:", err);
    res.status(500).json({ success: false, message: "Failed to compress PDF." });
  }
});

router.get("/download/:id", async (req, res) => {
  try {
    const file = await ConvertedFile.findById(req.params.id);

    if (!file || !fs.existsSync(file.path)) {
      return res.status(404).json({ success: false, message: "Download file not found or expired." });
    }

    await ConvertedFile.updateOne(
      { _id: file._id },
      {
        $inc: { downloadCount: 1 },
        $set: { lastDownloadedAt: new Date() }
      }
    );
    AnalyticsEvent.create({
      type: "download",
      toolSlug: file.toolSlug,
      path: req.originalUrl,
      device: /mobile|android|iphone|ipad/i.test(req.get("user-agent") || "") ? "mobile" : "desktop",
      source: "direct"
    }).catch(() => {});

    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.download(file.path, file.filename);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ success: false, message: "Failed to download file." });
  }
});

router.get("/downloads/:id/status", async (req, res) => {
  try {
    const file = await ConvertedFile.findById(req.params.id).select("-path");

    if (!file) {
      return res.status(404).json({ success: false, message: "Download record not found or expired." });
    }

    res.json({ success: true, file });
  } catch (err) {
    console.error("Download status error:", err);
    res.status(500).json({ success: false, message: "Failed to read download status." });
  }
});

router.post("/:slug/view", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const tool = await Tool.findOneAndUpdate(
      { slug, status: "active" },
      {
        $inc: { views: 1 },
        $set: { lastViewedAt: new Date() }
      },
      { new: true }
    );

    if (!tool) {
      return res.status(404).json({ success: false, message: "Tool not found" });
    }

    res.json({ success: true, views: tool.views });
  } catch (err) {
    console.error("Tool view tracking error:", err);
    res.status(500).json({ success: false, message: "Failed to track view." });
  }
});

router.get("/:slug/affiliate", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const tool = await Tool.findOneAndUpdate(
      { slug, status: "active" },
      {
        $inc: { affiliateClicks: 1 },
        $set: { lastAffiliateClickAt: new Date() }
      },
      { new: true }
    );

    if (!tool || !tool.affiliateUrl) {
      return res.redirect("/affiliate-disclosure.html");
    }

    res.redirect(tool.affiliateUrl);
  } catch (err) {
    console.error("Affiliate click tracking error:", err);
    res.redirect("/affiliate-disclosure.html");
  }
});

router.get("/", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(getFallbackTools());
    }

    const tools = await Tool.find({ status: "active" }).sort({ name: 1 });
    res.json(tools);
  } catch (err) {
    console.error("Tools fetch error:", err);
    return res.json(getFallbackTools());
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);

    if (mongoose.connection.readyState !== 1) {
      const tool = getFallbackToolBySlug(slug);
      if (!tool) {
        return res.status(404).json({ error: "Tool not found" });
      }
      return res.json(tool);
    }

    const tool = await Tool.findOne({
      slug,
      status: "active"
    });

    if (!tool) {
      return res.status(404).json({ error: "Tool not found" });
    }

    res.json(tool);
  } catch (err) {
    console.error("Tool fetch error:", err);
    return res.json(getFallbackToolBySlug(normalizeSlug(req.params.slug)) || { error: "Tool not found" });
  }
});

module.exports = router;
