const express = require("express");
const router = express.Router();
const axios = require("axios");
const Appointment = require("../models/Appointment");

const HELTAR_API_KEY = process.env.HELTAR_API_KEY;

router.post("/whatsapp-webhook", async (req, res) => {
  try {
    // ✅ WhatsApp (Meta/Heltar) payload structure:
    // req.body.entry[0].changes[0].value.messages
    const messages =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages || [];

    console.log("📩 Incoming messages:", JSON.stringify(messages, null, 2));
    console.log("📦 FULL request body:", JSON.stringify(req.body, null, 2));

    for (const msg of messages) {
      // ✅ Handle button clicks
      if (msg.type === "button" && msg.button?.payload) {
        const [action, appointmentId] = msg.button.payload.split("-");
        await updateAppointmentStatus(appointmentId, action, msg.from);
      }

      // ✅ Handle plain text replies ("Yes"/"No")
      if (msg.type === "text" && msg.text?.body) {
        const reply = msg.text.body.trim().toLowerCase();

        // Normalize phone → last 10 digits to match DB
        let incomingPhone = msg.from.replace("+", ""); // 919993724192
        incomingPhone = incomingPhone.slice(-10);      // 7993724192

        const appointment = await Appointment.findOne({
          phone: incomingPhone,
          status: "scheduled",
        }).sort({ date: -1 });

        if (!appointment) {
          console.log(`⚠️ No active appointment for ${msg.from}`);
          continue;
        }

        if (reply === "yes") {
          appointment.status = "confirmed";
        } else if (reply === "no") {
          appointment.status = "cancelled";
          appointment.cancelledAt = new Date();
        }

        await appointment.save();
        console.log(`📌 Appointment ${appointment._id} updated to ${appointment.status}`);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.sendStatus(500);
  }
});

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
