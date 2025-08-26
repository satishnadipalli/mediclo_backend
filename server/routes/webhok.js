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
    console.log("🚀 Webhook hit at", new Date().toISOString());
    console.log("📩 Full payload:", JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) {
      console.log("⚠️ No value in webhook");
      return res.sendStatus(200);
    }

    // ✅ Handle status updates (sent, delivered, read)
    if (value.statuses) {
      value.statuses.forEach((status) => {
        console.log(
          `📡 Status update: ${status.status} for ${status.recipient_id} (msgId: ${status.id})`
        );
        // 👉 TODO: Update message status in DB if you’re tracking it
      });
    }

    // ✅ Handle incoming messages
    if (value.messages) {
      for (const msg of value.messages) {
        const phone = normalizePhone(msg.from);
        console.log("☎ Normalized phone:", phone);

        let reply = "";
        if (msg.type === "button" && msg.button?.payload) {
          reply = msg.button.payload.trim().toLowerCase();
          console.log("🔘 Button reply:", reply);
        } else if (msg.type === "text" && msg.text?.body) {
          reply = msg.text.body.trim().toLowerCase();
          console.log("💬 Text reply:", reply);
        }

        if (reply) {
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
            console.log(
              `📌 Appointment ${appointment._id} updated to ${appointment.status}`
            );
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.sendStatus(500);
  }
});

module.exports = router;
