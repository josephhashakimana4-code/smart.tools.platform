const express = require("express");
const router = express.Router();

const Ad = require("../models/Ad");

router.get("/", async (req,res)=>{
  try{
    const ads = await Ad.find({active:true}).sort({createdAt:-1});
    res.json(ads);
  }catch(error){
    console.error("Ads fetch error:", error);
    res.status(500).json({error:"Failed to fetch ads"});
  }
});


router.post("/", async(req,res)=>{
  try{
    const ad = await Ad.create(req.body);
    res.status(201).json(ad);
  }catch(error){
    console.error("Ad creation error:", error);
    res.status(500).json({error:"Failed to create ad"});
  }
});


router.put("/:id", async(req,res)=>{
  try{
    const ad = await Ad.findByIdAndUpdate(
      req.params.id,
      req.body,
      {new:true}
    );

    res.json(ad);

  }catch(error){
    res.status(500).json({error:"Failed to update ad"});
  }
});


router.delete("/:id", async(req,res)=>{
  try{
    await Ad.findByIdAndDelete(req.params.id);

    res.json({
      message:"Ad deleted"
    });

  }catch(error){
    res.status(500).json({error:"Failed to delete ad"});
  }
});


module.exports = router;
