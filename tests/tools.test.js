const express = require("express");
const fs = require("fs");
const childProcess = require("child_process");
const request = require("supertest");
const mongoose = require("mongoose");
const { PDFDocument } = require("pdf-lib");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const Tool = require("../models/Tool");
const ConvertedFile = require("../models/ConvertedFile");
const toolsRouter = require("../routes/tools");

const app = express();
app.use(express.json());
app.use("/api/tools", toolsRouter);

describe("Tools routes", () => {
  const generatedPaths = [];

  afterEach(() => {
    jest.restoreAllMocks();
    for (const filePath of generatedPaths.splice(0)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  test("returns fallback tools and resolves normalized slug aliases while disconnected", async () => {
    const readyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 0;

    try {
      const listResponse = await request(app).get("/api/tools").expect(200);
      expect(listResponse.body.length).toBeGreaterThan(0);

      const detailResponse = await request(app)
        .get("/api/tools/wordtopdf.html")
        .expect(200);
      expect(detailResponse.body.slug).toBe("word-to-pdf");

      await request(app).get("/api/tools/not-a-real-tool").expect(404);
    } finally {
      mongoose.connection.readyState = readyState;
    }
  });

  test("reports optional S3 upload endpoints as unavailable when not configured", async () => {
    await request(app)
      .get("/api/tools/upload-url?filename=report.pdf")
      .expect(501)
      .expect(({ body }) => {
        expect(body.success).toBe(false);
      });

    await request(app)
      .post("/api/tools/upload-complete")
      .send({})
      .expect(400);

    await request(app)
      .post("/api/tools/upload-complete")
      .send({ key: "uploads/report.pdf" })
      .expect(501);
  });

  test("returns not found for missing download records", async () => {
    jest.spyOn(ConvertedFile, "findById").mockResolvedValue(null);

    await request(app)
      .get("/api/tools/download/missing-file")
      .expect(404);

    jest.spyOn(ConvertedFile, "findById").mockReturnValue({
      select: jest.fn().mockResolvedValue(null)
    });

    await request(app)
      .get("/api/tools/downloads/missing-file/status")
      .expect(404);
  });

  test("tracks a tool view and sends missing affiliate links to the disclosure page", async () => {
    const viewLookup = jest.spyOn(Tool, "findOneAndUpdate").mockResolvedValue({ views: 12 });
    const viewResponse = await request(app)
      .post("/api/tools/percentagecalculator/view")
      .expect(200);

    expect(viewResponse.body).toEqual({ success: true, views: 12 });
    expect(viewLookup).toHaveBeenCalledWith(
      { slug: "percentage-calculator", status: "active" },
      expect.objectContaining({ $inc: { views: 1 } }),
      { new: true }
    );

    viewLookup.mockResolvedValue(null);
    await request(app).post("/api/tools/unknown-tool/view").expect(404);

    jest.spyOn(Tool, "findOneAndUpdate").mockResolvedValue(null);
    await request(app)
      .get("/api/tools/unknown-tool/affiliate")
      .expect(302)
      .expect("Location", "/affiliate-disclosure.html");
  });

  test("uses database-backed tool lookups when connected", async () => {
    const readyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;

    try {
      const tools = [{ slug: "database-tool", name: "Database Tool" }];
      const sort = jest.fn().mockResolvedValue(tools);
      jest.spyOn(Tool, "find").mockReturnValue({ sort });

      const listResponse = await request(app).get("/api/tools").expect(200);
      expect(listResponse.body).toEqual(tools);
      expect(sort).toHaveBeenCalledWith({ name: 1 });

      jest.spyOn(Tool, "findOne").mockResolvedValue(tools[0]);
      const detailResponse = await request(app)
        .get("/api/tools/database-tool")
        .expect(200);
      expect(detailResponse.body).toEqual(tools[0]);

      jest.spyOn(Tool, "findOne").mockResolvedValue(null);
      await request(app).get("/api/tools/missing-tool").expect(404);
    } finally {
      mongoose.connection.readyState = readyState;
    }
  });

  test("merges, splits, and compresses valid PDFs", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const pdfBuffer = Buffer.from(await pdf.save());
    const createRecord = jest.spyOn(ConvertedFile, "create").mockImplementation(async (values) => {
      generatedPaths.push(values.path);
      return { _id: `converted-${generatedPaths.length}` };
    });

    const mergeResponse = await request(app)
      .post("/api/tools/merge-pdf")
      .attach("files", pdfBuffer, { filename: "first.pdf", contentType: "application/pdf" })
      .attach("files", pdfBuffer, { filename: "second.pdf", contentType: "application/pdf" })
      .expect(200);
    expect(mergeResponse.body.success).toBe(true);

    const splitResponse = await request(app)
      .post("/api/tools/split-pdf")
      .field("page", "99")
      .attach("file", pdfBuffer, { filename: "source.pdf", contentType: "application/pdf" })
      .expect(200);
    expect(splitResponse.body.totalPages).toBe(1);

    const compressResponse = await request(app)
      .post("/api/tools/pdf-compressor")
      .attach("file", pdfBuffer, { filename: "source.pdf", contentType: "application/pdf" })
      .expect(200);
    expect(compressResponse.body.compressedSize).toBeGreaterThan(0);
    expect(createRecord).toHaveBeenCalledTimes(3);

    await request(app)
      .post("/api/tools/merge-pdf")
      .attach("files", pdfBuffer, { filename: "only.pdf", contentType: "application/pdf" })
      .expect(400);
  });

  test("uses connected tool records and handles view, affiliate, and status outcomes", async () => {
    const readyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;

    try {
      const tools = [{ slug: "database-tool" }];
      jest.spyOn(Tool, "find").mockReturnValue({ sort: jest.fn().mockResolvedValue(tools) });
      await request(app).get("/api/tools").expect(200, tools);

      jest.spyOn(Tool, "findOne").mockResolvedValueOnce(tools[0]).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("lookup failed"));
      await request(app).get("/api/tools/database-tool.html").expect(200, tools[0]);
      await request(app).get("/api/tools/missing-tool").expect(404);
      await request(app).get("/api/tools/broken-tool").expect(200);

      jest.spyOn(Tool, "findOneAndUpdate")
        .mockResolvedValueOnce({ views: 4 })
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error("view update failed"))
        .mockResolvedValueOnce({ affiliateUrl: "https://affiliate.example.test" })
        .mockRejectedValueOnce(new Error("affiliate update failed"));
      await request(app).post("/api/tools/percentagecalculator/view").expect(200);
      await request(app).post("/api/tools/missing-tool/view").expect(404);
      await request(app).post("/api/tools/broken-tool/view").expect(500);
      await request(app)
        .get("/api/tools/wordtopdf/affiliate")
        .expect(302)
        .expect("Location", "https://affiliate.example.test");
      await request(app)
        .get("/api/tools/broken-tool/affiliate")
        .expect(302)
        .expect("Location", "/affiliate-disclosure.html");

      jest.spyOn(ConvertedFile, "findById").mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ _id: "file-1", filename: "file.pdf" })
      }).mockReturnValueOnce({
        select: jest.fn().mockRejectedValue(new Error("status lookup failed"))
      }).mockResolvedValue(null);
      await request(app).get("/api/tools/downloads/file-1/status").expect(200);
      await request(app).get("/api/tools/downloads/broken/status").expect(500);
      await request(app).get("/api/tools/download/missing-file").expect(404);
    } finally {
      mongoose.connection.readyState = readyState;
    }
  });

  test("rejects invalid and infected uploads and enforces required scanning", async () => {
    const originalRequired = process.env.CLAMAV_REQUIRED;
    delete process.env.CLAMAV_REQUIRED;

    try {
      const pdf = await PDFDocument.create();
      pdf.addPage();
      const validPdf = Buffer.from(await pdf.save());

      await request(app)
        .post("/api/tools/pdf-compressor")
        .attach("file", Buffer.from("not a pdf document"), { filename: "invalid.pdf", contentType: "application/pdf" })
        .expect(400);

      jest.spyOn(childProcess, "execFile").mockImplementation((command, args, options, callback) => {
        const error = Object.assign(new Error("malware found"), { code: 1, stdout: "test FOUND" });
        callback(error, "test FOUND", "");
      });
      await request(app)
        .post("/api/tools/pdf-compressor")
        .attach("file", validPdf, { filename: "infected.pdf", contentType: "application/pdf" })
        .expect(400);

      jest.restoreAllMocks();
      jest.spyOn(childProcess, "execFile").mockImplementation((command, args, options, callback) => {
        callback(Object.assign(new Error("scanner missing"), { code: "ENOENT" }), "", "");
      });
      process.env.CLAMAV_REQUIRED = "true";
      const docx = await Packer.toBuffer(new Document({
        sections: [{ children: [new Paragraph({ children: [new TextRun("Security scan test")] })] }]
      }));
      await request(app)
        .post("/api/tools/word-to-pdf")
        .attach("file", docx, {
          filename: "scanner-required.docx",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        })
        .expect(503);

      process.env.CLAMAV_REQUIRED = "false";
      await request(app)
        .post("/api/tools/pdf-compressor")
        .attach("file", Buffer.from("%PDF-invalid-content"), { filename: "broken.pdf", contentType: "application/pdf" })
        .expect(500);
    } finally {
      jest.restoreAllMocks();
      if (originalRequired === undefined) delete process.env.CLAMAV_REQUIRED;
      else process.env.CLAMAV_REQUIRED = originalRequired;
    }
  });

});
