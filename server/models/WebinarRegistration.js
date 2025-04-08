const mongoose = require("mongoose");

const WebinarRegistrationSchema = new mongoose.Schema(
  {
    webinarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Webinar",
      required: [true, "Webinar ID is required"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    phone: {
      type: String,
    }
  },
  {
    timestamps: true,
  }
);

// Create compound index to prevent duplicate registrations
WebinarRegistrationSchema.index({ webinarId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model(
  "WebinarRegistration",
  WebinarRegistrationSchema
);
