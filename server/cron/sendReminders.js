const cron = require("node-cron");
const Appointment = require("../models/Appointment");
const { sendAppointmentReminder } = require("../services/whatsapp");

const sendReminders = () => {
  // Run every day at 12:00 PM server time
  cron.schedule("*/1 * * * *", async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const appointments = await Appointment.find({
        date: {
          $gte: new Date(tomorrow.setHours(0, 0, 0, 0)),
          $lt: new Date(tomorrow.setHours(23, 59, 59, 999)),
        },
        status: "scheduled",
      });

      console.log(`📅 Found ${appointments.length} appointments for tomorrow`);

      for (const appointment of appointments) {
        console.log("sending appointmetns")
        await sendAppointmentReminder(appointment);
      }
    } catch (error) {
      console.error("❌ Error sending daily reminders:", error);
    }
  });
};

module.exports = sendReminders;
