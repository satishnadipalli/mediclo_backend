const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");

function normalizePhone(rawPhone) {
  if (!rawPhone) return "";

  let phone = String(rawPhone).replace(/^\+/, "").trim();

  // If starts with "91" and longer than 10 digits, drop country code
  if (phone.startsWith("91") && phone.length > 10) {
    phone = phone.slice(2);
  }

  return phone;
}



router.post("/whatsapp-webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages || [];

    console.log("📩 Full incoming payload:", JSON.stringify(req.body, null, 2));

    for (const msg of messages) {
      const phone = normalizePhone(msg.from);  // 🔥 normalize here
      console.log("☎ Normalized phone:", phone);

      // ✅ Handle button clicks
      if (msg.type === "button" && msg.button?.payload) {
        const reply = msg.button.payload.trim().toLowerCase();

        const appointment = await Appointment.findOne({
          phone,
          status: "scheduled",
        }).sort({ date: -1 });

        if (!appointment) {
          console.log(`⚠️ No active appointment for ${phone}`);
          continue;
        }

        if (reply === "yes" || reply === "confirm") {
          appointment.status = "confirmed";
        } else if (reply === "no" || reply === "cancel") {
          appointment.status = "cancelled";
          appointment.cancelledAt = new Date();
        }

        await appointment.save();
        console.log(`📌 Appointment ${appointment._id} updated to ${appointment.status}`);
      }

      // ✅ Handle text replies ("Yes"/"No")
      if (msg.type === "text" && msg.text?.body) {
        const reply = msg.text.body.trim().toLowerCase();

        const appointment = await Appointment.findOne({
          phone,
          status: "scheduled",
        }).sort({ date: -1 });

        if (!appointment) {
          console.log(`⚠️ No active appointment for ${phone}`);
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


module.exports = router;


// const id = 917993724192

// console.log(normalizePhone(id))