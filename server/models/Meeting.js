
const mongoose = require("mongoose");

const MeetingSchema = new mongoose.Schema(
  {
    meetLink: {
      type: String,
      required: [true, "Meeting link is required"],
      unique: true,
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Meeting date is required"],
    },
    startTime: {
      type: String, // e.g., "10:00 AM"
      required: [true, "Start time is required"],
      trim: true,
    },
    endTime: {
      type: String, // e.g., "11:00 AM"
      required: [true, "End time is required"],
      trim: true,
    },
    approxDuration: {
      type: String, // e.g., "60 minutes"
      trim: true,
    },
    hostDoctor: {
      type: String,
      required: [true, "Host doctor name is required"],
      trim: true,
    },
    associatedPlans: {
      type: [String], // e.g., ["prime", "basic"]
      default: [],
    },
  },
  {
    timestamps: true,
  },
)

// const Meeting = mongoose.model("Meeting", MeetingSchema)
module.exports = mongoose.model("Meeting", MeetingSchema);
// export default Meeting
