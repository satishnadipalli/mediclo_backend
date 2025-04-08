const mongoose = require("mongoose");

const SubscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    price: {
      type: Number,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "biannual", "annual"],
    },
    trialPeriod: {
      type: Number, // Days
      default: 0,
    },
    features: {
      accessToWebinars: {
        type: Boolean,
        default: false,
      },
      customerDiscounts: {
        type: Boolean,
        default: false,
      },
      autoRenewal: {
        type: Boolean,
        default: true,
      },
      displayOnPricingPage: {
        type: Boolean,
        default: true,
      },
      accessToPremiumCourses: {
        type: Boolean,
        default: false,
      },
    },
    gracePeriod: {
      type: Number, // Days
      default: 0,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SubscriptionPlan", SubscriptionPlanSchema);
