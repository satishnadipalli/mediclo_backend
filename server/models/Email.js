const mongoose = require("mongoose");

const EmailSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    subject: {
      type: String,
      required: [true, "Please add a subject"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Please add content"],
    },
    sender: {
      type: String,
      required: [true, "Please add sender email"],
      default: "wellness@example.com",
    },
    category: {
      type: String,
      default: "motivation",
      enum: ["motivation", "reminder", "announcement"],
    },
    sentToCount: {
      type: Number,
      default: 0,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    scheduledDate: {
      type: Date,
      default: Date.now,
    },
    tags: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for efficient queries
EmailSchema.index({ userId: 1, createdAt: -1 });
EmailSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model("Email", EmailSchema);
