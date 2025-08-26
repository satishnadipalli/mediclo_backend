const cron = require("node-cron");
const Appointment = require("../models/Appointment");
const { sendAppointmentReminder } = require("../services/whatsapp");

const sendReminders = () => {
  // Run every day at 12:00 PM server time (currently every minute for testing)
  cron.schedule("20 13 * * *", async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // clone for start and end of day
      const startOfDay = new Date(tomorrow);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(tomorrow);
      endOfDay.setHours(23, 59, 59, 999);

      const appointments = await Appointment.find({
        date: { $gte: startOfDay, $lt: endOfDay },
        status: "scheduled",
      });

      console.log(`📅 Found ${appointments.length} appointments for tomorrow`);

      for (const appointment of appointments) {
        console.log("📤 Sending appointment reminder:", appointment._id);

        // 👉 if your sendAppointmentReminder needs appointmentId
        await sendAppointmentReminder(appointment._id);

        // if you want to restrict for one number (like your debug check)
        // if (appointment.phone === "7993724192") {
        //   await sendAppointmentReminder(appointment._id);
        // }
      }
    } catch (error) {
      console.error("❌ Error sending daily reminders:", error);
    }
  });
};

module.exports = sendReminders;
