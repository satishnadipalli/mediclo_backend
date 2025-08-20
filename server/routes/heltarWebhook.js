// routes/heltarWebhook.js
const express = require("express");
const router = express.Router();

router.post("/", (req, res) => {
  console.log("📩 Incoming Heltar webhook:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200); // always reply 200 quickly
});

module.exports = router;
