const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const multer = require("multer");
const { fileTypeFromBuffer } = require("file-type");
const mammoth = require("mammoth");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { PDFParse } = require("pdf-parse");
const Tool = require("../models/Tool");
const validateFileSignature = require("../middlewares/fileValidator");
const ConvertedFile = require("../models/ConvertedFile");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const { getFallbackTools, getFallbackToolBySlug } = require("../config/fallbackTools");

const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword"
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 20
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Unsupported file type"), false);
    }

    cb(null, true);
  }
});

// --- File upload hardening helpers ---
const os = require("os");
const { writeFileSync, unlinkSync } = require("fs");
const { spawnSync } = require("child_process");

async function scanBufferForVirus(buffer) {
  // Try to use clamscan CLI if available. This is best-effort: if not present,
  // warn and allow upload (do NOT block deployment). In production, install
  // ClamAV and ensure `clamscan` is available or integrate with a managed
  // scanning service.
  try {
    const tmp = path.join(os.tmpdir(), `upload-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    writeFileSync(tmp, buffer);
    const res = spawnSync("clamscan", ["--no-summary", tmp], { encoding: "utf8", timeout: 20000 });
    unlinkSync(tmp);

    if (res.error) {
      console.warn("clamscan not available or failed:", res.error.message);
      // In production we fail closed when scanner is missing to avoid accepting
      // potentially dangerous uploads. In non-production we allow uploads.
      if (process.env.NODE_ENV === "production") {
        return { ok: false, info: "no-scanner" };
      }
      return { ok: true, info: "no-scanner" };
    }

    // clamscan prints: /tmp/...: OK  or /tmp/...: Eicar-Test-Signature FOUND
    const out = String(res.stdout || "") + String(res.stderr || "");
    if (/FOUND/i.test(out)) {
      return { ok: false, info: out.trim() };
    }

    return { ok: true, info: out.trim() };
  } catch (err) {
    console.warn("Virus scan failed:", err.message);
    if (process.env.NODE_ENV === "production") {
      return { ok: false, info: `scan-error: ${err.message}` };
    }
    return { ok: true, info: "scan-error" };
  }
}

// S3 presigned upload URL support (optional)
let s3Client = null;
let getPresignedUrl = null;
if (process.env.S3_BUCKET && process.env.S3_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  try {
    const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
    s3Client = new S3Client({ region: process.env.S3_REGION });
    getPresignedUrl = async (key, contentType, expires = 900) => {
      const cmd = new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ContentType: contentType });
      return getSignedUrl(s3Client, cmd, { expiresIn: expires });
    };
  } catch (err) {
    console.warn("S3 presign not available (missing SDK):", err.message);
    s3Client = null;
  }
}

async function validateFile(req, res, next) {
  if (!validateFileSignature(req.file)) {
    return res.status(400).json({
      success: false,
      message: "Invalid file signature. File content does not match extension."
    });
  }

  // Virus scan (best-effort)
  try {
    const result = await scanBufferForVirus(req.file.buffer);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: "Uploaded file appears to be infected", info: result.info });
    }
  } catch (err) {
    console.warn("Scan error:", err.message);
  }

  next();
}

async function validateFiles(req, res, next) {
  for (const file of req.files || []) {
    if (!validateFileSignature(file)) {
      return res.status(400).json({
        success: false,
        message: "One or more uploaded files are invalid."
      });
    }

    try {
      const result = await scanBufferForVirus(file.buffer);
      if (!result.ok) {
        return res.status(400).json({ success: false, message: "One or more uploaded files appear infected", info: result.info });
      }
    } catch (err) {
      console.warn("Scan error:", err.message);
    }
  }

  next();
}

async function validateUploadedFile(file) {
  if (!file || !file.buffer) {
    throw new Error("No file uploaded");
  }

  const type = await fileTypeFromBuffer(file.buffer);

  if (!type) {
    throw new Error("Unable to identify file type");
  }

  const allowedExtensions = ["pdf", "doc", "docx"];

  if (!allowedExtensions.includes(type.ext)) {
    throw new Error("Invalid file signature");
  }

  return true;
}

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

// --- Presigned upload URL endpoint ---
router.get("/upload-url", async (req, res) => {
  if (!getPresignedUrl) {
    return res.status(501).json({ success: false, message: "Presigned uploads not configured on this server" });
  }

  const filename = String(req.query.filename || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
  const contentType = String(req.query.contentType || "application/octet-stream");

  const ext = path.extname(filename).replace(".", "") || "bin";
  const key = `uploads/${safeName("client-upload", ext)}`;

  try {
    const url = await getPresignedUrl(key, contentType);
    res.json({ success: true, uploadUrl: url, key });
  } catch (err) {
    console.error("Presign error:", err);
    res.status(500).json({ success: false, message: "Failed to generate upload URL" });
  }
});

// Optional: after client uploads directly to S3, call this endpoint to register/scan
router.post("/upload-complete", async (req, res) => {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ success: false, message: "Missing key" });

  if (!s3Client) {
    return res.status(501).json({ success: false, message: "S3 not configured" });
  }

  try {
    // Download object and optionally scan - using getObject would require SDK; attempt if available
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    const streamToBuffer = async (stream) => {
      return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    };

    const getRes = await s3Client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    const body = await streamToBuffer(getRes.Body);
    const scan = await scanBufferForVirus(body);
    if (!scan.ok) {
      return res.status(400).json({ success: false, message: "Uploaded file failed virus scan", info: scan.info });
    }

    // Save a simple ConvertedFile record pointing to S3 key (path field holds key)
    const file = await ConvertedFile.create({ originalName: path.basename(key), filename: path.basename(key), path: key, mimeType: getRes.ContentType || "application/octet-stream", size: body.length });

    res.json({ success: true, id: file._id, key });
  } catch (err) {
    console.error("upload-complete error:", err);
    res.status(500).json({ success: false, message: "Failed to process uploaded file" });
  }
});

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
        "RemoteSigned",
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

router.post("/pdf-to-word", upload.single("file"), validateFile, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a PDF file." });
      await validateUploadedFile(req.file);
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

router.post("/word-to-pdf", upload.single("file"), validateFile, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a Word document." });
      await validateUploadedFile(req.file);
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

router.post("/merge-pdf", upload.array("files", 20), validateFiles, async (req, res) => {
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

router.post("/split-pdf", upload.single("file"), validateFile, async (req, res) => {
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

router.post("/pdf-compressor", upload.single("file"), validateFile, async (req, res) => {
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
