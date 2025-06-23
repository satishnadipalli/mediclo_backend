const cron = require("node-cron");
const ToyBorrowing = require("../models/ToyBorrowing");

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

module.exports = startOverdueUpdateJob;
