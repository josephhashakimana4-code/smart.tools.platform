const Test = require("../models/Test");

// Create a new record
exports.createTest = async (req, res) => {
  try {
    const data = await Test.create({ 
      name: "Joseph", 
      status: "Verified Connection" 
    });
    res.status(201).json({
      message: "Data saved to toolsdb successfully!",
      data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all records
exports.getTests = async (req, res) => {
  try {
    const data = await Test.find();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};