const express = require("express");
const router = express.Router();
const { createTest, getTests } = require("../controllers/testController");

// Full Path: http://localhost:5000/api/tests/add
router.get("/add", createTest);

// Full Path: http://localhost:5000/api/tests/all
router.get("/all", getTests);

module.exports = router;