const express = require("express");
const BlogPost = require("../models/BlogPost");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const posts = await BlogPost.find({ status: "published" })
      .sort({ publishedAt: -1, createdAt: -1 })
      .select("title slug excerpt metaDescription publishedAt createdAt");
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Failed to load blog posts." });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug, status: "published" });
    if (!post) return res.status(404).json({ message: "Blog post not found." });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: "Failed to load blog post." });
  }
});

module.exports = router;
