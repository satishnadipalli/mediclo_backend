const cron = require("node-cron");
const Appointment = require("../models/Appointment");
const { sendAppointmentReminder } = require("../services/whatsapp");

const sendReminders = () => {
  // Run every day at 1:20 PM (local timezone can be set below)
  cron.schedule(
    "55 11 * * *",
    async () => {
      console.log("⏰ Cron job triggered at:", new Date().toString());

      try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const startOfDay = new Date(tomorrow);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(tomorrow);
        endOfDay.setHours(23, 59, 59, 999);

        const appointments = await Appointment.find({
          date: { $gte: startOfDay, $lt: endOfDay },
          status: "scheduled",
        });

        console.log(
          `📅 Found ${appointments.length} appointments for tomorrow`
        );

        for (const appointment of appointments) {
          // ✅ Skip if already reminded today
          if (
            appointment.lastReminderSent &&
            appointment.lastReminderSent.toDateString() === new Date().toDateString()
          ) {
            console.log(
              `⚠️ Reminder already sent today for ${appointment._id}, skipping`
            );
            continue;
          }

          console.log("📤 Sending appointment reminder:", appointment._id);
          await sendAppointmentReminder(appointment._id);

          // ✅ Track reminder
          appointment.remindersSent = (appointment.remindersSent || 0) + 1;
          appointment.lastReminderSent = new Date();
          await appointment.save();
        }
      } catch (error) {
        console.error("❌ Error sending daily reminders:", error);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata", // ⚠️ adjust to your timezone
    }
  );
};

module.exports = sendReminders;
