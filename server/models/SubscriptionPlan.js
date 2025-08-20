const mongoose = require("mongoose");

const SubscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      trim: true,
      required: [true, "Please provide a valid plan name"],
    },
    description: {
      type: String,
      required: [true, "Please provide a plan description"],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    price: {
      type: Number,
      required: [false, "Please provide a price"],
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "biannual", "annual"],
      required: [true, "Please provide a billing cycle"],
    },
    trialPeriod: {
      type: Number,
      default: 0, //In days
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
      type: Number,
      default: 0, // In days
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
