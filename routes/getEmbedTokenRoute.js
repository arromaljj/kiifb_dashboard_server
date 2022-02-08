const express = require("express");
const router = express.Router();
const getEmbedToken = require("../getEmbedToken").generateEmbedToken;
// let Config = require("../config/Config.json");

router.post("/", async (req, res, next) => {
  try {
    const config = req.body;
    const result = await getEmbedToken(config);
    res.json(result);
  } catch (err) {
    res.status(400).send(err);
  }
});

module.exports = router;
