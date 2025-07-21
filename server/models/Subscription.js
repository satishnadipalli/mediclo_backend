const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    name: {
      type: String,
      required: [true, "Please add a name"],
    },
    email: {
      type: String,
      required: [false, "Please add an email"],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
      unique: false,
    },
    phone: {
      type: String,
      required: [true, "Please add a phone number"],
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: [true, "Please add a subscription plan"],
    },
    currentTier: {
      type: String,
      required: [true, "Please add current tier"],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, "Please add end date"],
    },
    nextRenewalDate: {
      type: Date,
      required: [true, "Please add next renewal date"],
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "pending", "failed", "cancelled"],
      default: "pending",
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    paymentHistory: [
      {
        amount: {
          type: Number,
        },
        status: {
          type: String,
          enum: ["successful", "failed", "pending", "refunded"],
        },
        paymentMethod: {
          type: String,
        },
        transactionId: {
          type: String,
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for checking if subscription is expired
SubscriptionSchema.virtual("isExpired").get(function () {
  return new Date() > this.endDate;
});

// Virtual for days remaining in subscription
SubscriptionSchema.virtual("daysRemaining").get(function () {
  const today = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - today;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

module.exports = mongoose.model("Subscription", SubscriptionSchema);
