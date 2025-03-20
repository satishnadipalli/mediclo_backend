const mongoose = require("mongoose");

const ServiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a service name"],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please add a description"],
    },
    category: {
      type: String,
      required: [true, "Please add a category"],
      enum: [
        "Occupational Therapy",
        "Speech Therapy",
        "Physical Therapy",
        "Assessment",
        "Consultation",
        "Other",
      ],
    },
    duration: {
      type: Number,
      required: [true, "Please add duration in minutes"],
    },
    price: {
      type: Number,
      required: [true, "Please add a price"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Service", ServiceSchema);
