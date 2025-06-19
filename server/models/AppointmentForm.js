const mongoose = require("mongoose");

const AppointmentFormSchema = new mongoose.Schema({
  motherName: {
    type: String,
    required: true,
  },
  fatherName: {
    type: String,
    required: true,
  },
  childName: {
    type: String,
    required: true,
  },
  phone: {
    type: Number,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  childAge: {
    type: Number,
    required: true,
  },
  serviceType: {
    type: String,
    enum: [
      "Occupational Therapy",
      "Speech Therapy",
      "Physical Therapy",
      "Assessment",
      "Consultation",
      "Other",
      "Not_selected",
    ],
    default: "not_specified",
  },
  preferredDate: {
    type: Date,
    required: true,
  },
  preferredTime: {
    type: String,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["card", "cash", "insurance", "not_specified"],
    default: "not_specified",
  },
  notes: {
    type: String,
  },
  status: {
    type: String,
    enum: ["pending", "scheduled", "cancelled"],
    default: "pending",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model("AppointmentForm", AppointmentFormSchema);
