const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");

// Heltar sends simpler JSON than Meta
router.post("/whatsapp-webhook", async (req, res) => {
  const messages = req.body.messages || [];

  for (const msg of messages) {
    if (msg.type === "button") {
      const buttonId = msg.button.payload; // e.g. confirm-abc123
      const appointmentId = buttonId.split("-")[1];

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) continue;

      if (buttonId.startsWith("confirm")) {
        appointment.status = "confirmed";
      } else if (buttonId.startsWith("cancel")) {
        appointment.status = "cancelled";
        appointment.cancelledAt = new Date();
      }

      await appointment.save();
      console.log(`📌 Appointment ${appointment._id} updated to ${appointment.status}`);
    }
  }

  res.sendStatus(200);
});

module.exports = router;
