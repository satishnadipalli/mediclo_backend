const mongoose = require("mongoose");

const detoxPlanSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: String, // e.g., "7 days", "14 days"
      required: true,
    },
    meals: [
      {
        day: String,
        mealPlan: String,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DetoxPlan", detoxPlanSchema);
