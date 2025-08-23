const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");

function normalizePhone(rawPhone) {
  console.log("rawphone before",rawPhone)
  if (!rawPhone) return "";
  console.log("rawphone after",rawPhone)
  let phone = String(rawPhone).replace(/^\+/, "").trim();

  // If starts with "91" and longer than 10 digits, drop country code
  if (phone.startsWith("91") && phone.length > 10) {
    phone = phone.slice(2);
  }

  console.log(phone)
  return phone;
}

router.post("/whatsapp-webhook", async (req, res) => {
  try {
    console.log("🚀 Loaded whatsapp-webhook router at", new Date().toISOString());

    console.log("📩 Full incoming payload:", JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages || [];

    const msg = messages?.[0];
    if (!msg) {
      console.log("⚠️ No message found in webhook payload",msg);
      return res.sendStatus(200);
    }

    console.log(msg)

    const phone = normalizePhone(msg.from);
    console.log("☎ Normalized phone:", phone);

    // ✅ Handle button clicks
    if (msg.type === "button" && msg.button?.payload) {
      const reply = msg.button.payload.trim().toLowerCase();
      console.log("🔘 Button reply:", reply);

      const appointment = await Appointment.findOne({
        phone,
        status: "scheduled",
      }).sort({ date: -1 });

      if (!appointment) {
        console.log(`⚠️ No active appointment for ${phone}`);
      } else {
        if (reply === "yes" || reply === "confirm") {
          appointment.status = "confirmed";
        } else if (reply === "no" || reply === "cancel") {
          appointment.status = "cancelled";
          appointment.cancelledAt = new Date();
        }

        await appointment.save();
        console.log(`📌 Appointment ${appointment._id} updated to ${appointment.status}`);
      }
    }

    // ✅ Handle text replies
    if (msg.type === "text" && msg.text?.body) {
      const reply = msg.text.body.trim().toLowerCase();
      console.log("💬 Text reply:", reply);

      const appointment = await Appointment.findOne({
        phone,
        status: "scheduled",
      }).sort({ date: -1 });

      if (!appointment) {
        console.log(`⚠️ No active appointment for ${phone}`);
      } else {
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

module.exports = router;
