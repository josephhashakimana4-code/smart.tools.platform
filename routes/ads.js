const express = require("express");
const mongoose = require("mongoose");
const Ad = require("../models/Ad");

const router = express.Router();

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

const ALLOWED_POSITIONS = [
  "top",
  "sidebar",
  "footer",
  "in-tool"
];

function normalizePosition(value) {
  const position = String(value || "top")
    .trim()
    .toLowerCase();

  return ALLOWED_POSITIONS.includes(position)
    ? position
    : "top";
}

/*
 * PUBLIC ADS API
 *
 * This router is intentionally READ-ONLY.
 *
 * Public users can:
 *   GET /api/ads
 *
 * Public users cannot:
 *   POST /api/ads
 *   PUT /api/ads/:id
 *   DELETE /api/ads/:id
 *
 * Advertisement management is handled by:
 *   /api/admin/ads
 */

/*
 * GET /api/ads
 *
 * Returns active advertisements.
 *
 * Optional:
 *   GET /api/ads?position=top
 *   GET /api/ads?position=sidebar
 *   GET /api/ads?position=footer
 *   GET /api/ads?position=in-tool
 */
router.get("/", async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.json([]);
    }

    const filter = {
      active: true
    };

    if (req.query.position) {
      filter.position = normalizePosition(req.query.position);
    }

    const ads = await Ad.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json(
      ads.map((ad) => ({
        ...ad,
        _id: String(ad._id)
      }))
    );
  } catch (err) {
    console.error("Public ads fetch error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to load advertisements."
    });
  }
});

/*
 * Block public advertisement creation.
 */
router.post("/", (req, res) => {
  return res.status(405).json({
    success: false,
    message: "Advertisement creation is restricted to administrators."
  });
});

/*
 * Block public advertisement updates.
 */
router.put("/:id", (req, res) => {
  return res.status(405).json({
    success: false,
    message: "Advertisement updates are restricted to administrators."
  });
});

/*
 * Block public advertisement deletion.
 */
router.delete("/:id", (req, res) => {
  return res.status(405).json({
    success: false,
    message: "Advertisement deletion is restricted to administrators."
  });
});

module.exports = router;
