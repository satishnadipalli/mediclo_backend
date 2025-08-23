const cron = require("node-cron");
const axios = require("axios");
const Appointment = require("../models/Appointment");

const HELTAR_API_KEY = process.env.HELTAR_API_KEY;

function checkReplies() {
  // Runs every 1 minute
  cron.schedule("*/1 * * * *", async () => {
    try {
      const appointments = await Appointment.find({ status: "scheduled" });

      for (const apt of appointments) {
        // Example call: you’ll later replace with actual "Yes/No" fetch
        const res = await axios.get(
          `https://api.heltar.com/v1/suggestions/?query=Yes`,
          {
            headers: {
              Authorization: `Bearer ${HELTAR_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        const suggestions = res.data?.suggestions || [];

        if (suggestions.includes("Yes")) {
          apt.status = "confirmed";
          await apt.save();
          console.log(`✅ Appointment ${apt._id} confirmed`);
        } else if (suggestions.includes("No")) {
          apt.status = "cancelled";
          apt.cancelledAt = new Date();
          await apt.save();
          console.log(`❌ Appointment ${apt._id} cancelled`);
        }
      }
    } catch (err) {
      console.error("❌ Error checking replies:", err.message);
    }
  });
}

module.exports = checkReplies; // 👈 export properly
