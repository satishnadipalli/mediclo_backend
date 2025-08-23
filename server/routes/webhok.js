const express = require("express");
const router = express.Router();
const axios = require("axios");
const Appointment = require("../models/Appointment");

const HELTAR_API_KEY = process.env.HELTAR_API_KEY;

router.post("/whatsapp-webhook", async (req, res) => {
  try {
    console.log("📩 Full incoming payload:", JSON.stringify(req.body, null, 2));

    // ✅ WhatsApp payload structure: entry → changes → value → messages
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages || [];

    for (const msg of messages) {
      let reply = null;

      // ✅ Case 1: Button click
      if (msg.type === "button" && msg.button?.payload) {
        reply = msg.button.payload.trim().toLowerCase();
      }

      // ✅ Case 2: Text reply
      if (msg.type === "text" && msg.text?.body) {
        reply = msg.text.body.trim().toLowerCase();
      }

      if (!reply) continue;

      // ✅ Normalize phone
      const phone = msg.from.replace("+", "");

      // ✅ Find latest scheduled appointment for this phone
      const appointment = await Appointment.findOne({
        phone,
        status: "scheduled",
      }).sort({ date: -1 });

      if (!appointment) {
        console.log(`⚠️ No active appointment for ${msg.from}`);
        continue;
      }

      // ✅ Update status
      if (reply === "yes") {
        appointment.status = "confirmed";
      } else if (reply === "no") {
        appointment.status = "cancelled";
        appointment.cancelledAt = new Date();
      }

      await appointment.save();
      console.log(`📌 Appointment ${appointment._id} updated to ${appointment.status}`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err.message, err.stack);
    res.sendStatus(500);
  }
});

module.exports = router;



async function updateAppointmentStatus(appointmentId, action, from) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) return;

  if (action === "confirm") appointment.status = "confirmed";
  else if (action === "cancel") {
    appointment.status = "cancelled";
    appointment.cancelledAt = new Date();
  }

  await appointment.save();
  console.log(`📌 Appointment ${appointment._id} updated to ${appointment.status}`);
}


module.exports = router;
