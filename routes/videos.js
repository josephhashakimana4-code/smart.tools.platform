const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Video = require("../models/Video");
const VideoView = require("../models/VideoView");
const memoryVideos = require("../utils/videoMemory");

const router = express.Router();
const dbReady = () => mongoose.connection.readyState === 1;
const memoryViews = new Map();

function safeVideoUrl(value) {
  const url = String(value || "").trim();
  return url.startsWith("/") && !url.startsWith("//") || /^https:\/\//i.test(url);
}

function getVisitorHash(req) {
  const secret = process.env.VIDEO_VIEW_SECRET || process.env.JWT_ACCESS_SECRET || "smart-tools-view-counter";
  return crypto.createHmac("sha256", secret).update(`${req.ip || "unknown"}|${req.get("user-agent") || ""}`).digest("hex");
}

router.get("/", async (_req, res) => {
  if (!dbReady()) return res.json(memoryVideos.filter((video) => video.status === "published").slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  try {
    const videos = await Video.find({ status: "published" }).sort({ createdAt: -1 }).lean();
    res.json(videos);
  } catch (error) {
    console.error("Public videos fetch error:", error);
    res.status(500).json({ message: "Could not load videos." });
  }
});

router.post("/:id/view", async (req, res) => {
  if (!dbReady()) {
    const video = memoryVideos.find((item) => item._id === req.params.id && item.status === "published");
    if (!video) return res.status(404).json({ message: "Video not found." });
    const day = new Date().toISOString().slice(0, 10);
    const key = `${video._id}:${getVisitorHash(req)}:${day}`;
    const now = Date.now();
    for (const [savedKey, expiresAt] of memoryViews) if (expiresAt <= now) memoryViews.delete(savedKey);
    if (!memoryViews.has(key)) {
      memoryViews.set(key, now + 36 * 60 * 60 * 1000);
      video.views = Number(video.views || 0) + 1;
      return res.json({ success: true, tracked: true, views: video.views });
    }
    return res.json({ success: true, tracked: false, views: video.views });
  }
  try {
    const video = await Video.findOne({ _id: req.params.id, status: "published" }).select("_id views");
    if (!video) return res.status(404).json({ message: "Video not found." });
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    try {
      await VideoView.create({
        videoId: video._id,
        visitorHash: getVisitorHash(req),
        day,
        expiresAt: new Date(now.getTime() + 36 * 60 * 60 * 1000)
      });
    } catch (error) {
      if (error.code === 11000) return res.json({ success: true, tracked: false, views: video.views });
      throw error;
    }
    video.views += 1;
    await video.save();
    res.json({ success: true, tracked: true, views: video.views });
  } catch (error) {
    res.status(400).json({ message: "Could not track this video view." });
  }
});

router.post("/", (_req, res) => res.status(405).json({ message: "Video management is restricted to administrators." }));
router.put("/:id", (_req, res) => res.status(405).json({ message: "Video management is restricted to administrators." }));
router.delete("/:id", (_req, res) => res.status(405).json({ message: "Video management is restricted to administrators." }));

module.exports = { router, safeVideoUrl };
