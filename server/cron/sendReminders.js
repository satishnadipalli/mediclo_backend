const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");

function normalizePhone(rawPhone) {
  if (!rawPhone) return ""; // handle null/undefined safely

  // force to string
  let phone = String(rawPhone).replace(/^\+/, "");

  // if starts with 91 and length > 10, drop it
  if (phone.startsWith("91") && phone.length > 10) {
    phone = phone.slice(2);
  }

  return phone.trim();
}



router.post("/whatsapp-webhook", async (req, res) => {
  try {
    const messages = req.body?.entry?.[0]?.changes?.[0]?.value?.messages || [];
    console.log("📩 Incoming messages:", JSON.stringify(messages, null, 2));

    for (const msg of messages) {
      const rawFrom = msg.from;
      const phone = normalizePhone(rawFrom);

      console.log(`☎️ Raw from: ${rawFrom} | Normalized: ${phone}`);

      // ✅ Handle button clicks
      if (msg.type === "button" && msg.button?.payload) {
        const reply = msg.button.payload.trim().toLowerCase();

        const appointment = await Appointment.findOne({
          phone, // always normalized
          status: "scheduled",
        }).sort({ date: -1 });

        if (!appointment) {
          console.log(`⚠️ No active appointment found for normalized phone ${phone}`);
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

      // ✅ Handle plain text replies
      if (msg.type === "text" && msg.text?.body) {
        const reply = msg.text.body.trim().toLowerCase();

        const appointment = await Appointment.findOne({
          phone, // always normalized
          status: "scheduled",
        }).sort({ date: -1 });

        if (!appointment) {
          console.log(`⚠️ No active appointment found for normalized phone ${phone}`);
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