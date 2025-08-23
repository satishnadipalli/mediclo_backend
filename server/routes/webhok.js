const express = require("express");
const router = express.Router();
const axios = require("axios");
const Appointment = require("../models/Appointment");

const HELTAR_API_KEY = process.env.HELTAR_API_KEY;

// ✅ Main webhook route
router.post("/whatsapp-webhook", async (req, res) => {
  try {
    const messages = req.body.messages || [];
    console.log("📩 Incoming messages:", JSON.stringify(messages, null, 2));

    for (const msg of messages) {
      let reply = null;

      // ✅ Case 1: Button click (payload "Yes" / "No")
      if (msg.type === "button" && msg.button?.payload) {
        reply = msg.button.payload.trim().toLowerCase();
      }

      // ✅ Case 2: Text reply ("Yes" / "No")
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

      // ✅ Update status based on reply
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
    console.error("❌ Webhook error:", err.message);
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
