const cron = require("node-cron");
const ToyBorrowing = require("../models/ToyBorrowing");
const User = require("../models/User");
const sendEmail = require("../utils/mailer");
const membershipReminder = require("../emails/membershipReminder");

/**
 * cron job to update overdue borrowings at midnight daily
 */
const startOverdueUpdateJob = () => {
  cron.schedule(
    "0 0 * * *", // Midnight every day
    async () => {
      console.log("⏰ Midnight job running: Updating overdue borrowings...");

      try {
        const result = await ToyBorrowing.updateMany(
          {
            returnDate: { $exists: false },
            dueDate: { $lt: new Date() },
            status: "Borrowed",
          },
          { status: "Overdue" }
        );

        console.log(`Updated ${result.modifiedCount} borrowings to Overdue`);
      } catch (err) {
        console.error("Error updating overdue borrowings:", err);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );
};

/**
 * cron job to send subscription renewal reminder 3 days in advance
 */
const startRenewalReminderJob = () => {
  cron.schedule(
    "0 9 * * *", //Evryday 9am
    async () => {
      console.log("9 AM job running: Sending subscription renewal reminders..");

      try {
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 3);

        //Remove time to compare only dates
        targetDate.setHours(0, 0, 0, 0);

        const nextDay = new Date(targetDate);
        nextDay.setDate(targetDate.getDate() + 1);

        const usersToRemind = await user.find({
          subscriptionEnd: {
            $gte: targetDate,
            $lt: nextDay,
          },
        });

        for (const user of usersToRemind) {
          await sendEmail({
            to: user.email,
            subject: "Your membership Renewal Reminder",
            html: membershipReminder(
              user.firstName || user.fullName || "User",
              user.subscriptionEnd.toDateString()
            ),
          });

          console.log(`Reminder sent to: ${user.email}`);
        }

        console.log(
          `Sent renewal reminders to ${usersToRemind.length} user(s)`
        );
      } catch (error) {
        console.error("Error sending renewal reminders:", err);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );
};

module.exports = {
  startOverdueUpdateJob,
  startRenewalReminderJob,
};
