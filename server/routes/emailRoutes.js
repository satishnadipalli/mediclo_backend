const express = require("express");
const router = express.Router();
const sendEmail = require("../utils/mailer");
const membershipReminder = require("../emails/membershipReminder");
const weeklyMotivation = require("../emails/weeklyMotivation");

//membership reminder
router.post("/send-renewal", async (req, res) => {
  const { to, name, renewalDate } = req.body;

  try {
    await sendEmail({
      to,
      subject: `Your Membership Renewal Reminder`,
      html: membershipReminder(name, renewalDate),
    });

    res
      .status(200)
      .json({ success: true, message: "Renewal email sent successfully " });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

//weekly motivation
router.post("/send-motivation", async (req, res) => {
  const { to, name, quote } = req.body;

  try {
    await sendEmail({
      to,
      subject: "Weekly Motivation Just for You!",
      html: weeklyMotivation(name, quote),
    });

    res
      .status(200)
      .json({ success: true, message: "Motivation email sent successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
