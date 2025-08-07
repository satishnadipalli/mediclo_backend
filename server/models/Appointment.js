const mongoose = require("mongoose")

const appointmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: false,
    },
    patientName: {
      type: String,
      required: true,
    },
    fatherName: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: false,
    },
    phone: {
      type: String,
      required: false,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["initial assessment", "therapy session", "follow-up", "group therapy session"],
      default: "initial assessment",
    },
    consultationMode: {
      type: String,
      enum: ["in-person", "video-call", "phone"],
      default: "in-person",
    },
    notes: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    payment: {
      amount: {
        type: Number,
        default: 0,
      },
      method: {
        type: String,
        enum: ["cash", "upi", "not_specified"],
        default: "not_specified",
      },
      status: {
        type: String,
        enum: ["pending", "paid", "refunded"],
        default: "pending",
      },
    },
    consent: {
      type: Boolean,
      default: false,
    },
    totalSessions: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["scheduled", "confirmed", "in-progress", "completed", "cancelled", "no-show", "rescheduled", "converted"],
      default: "scheduled",
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    cancelledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    rescheduledFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    rescheduledTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    // Group session fields
    isGroupSession: {
      type: Boolean,
      default: false,
    },
    groupSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    groupSessionName: {
      type: String,
      required: false,
    },
    maxCapacity: {
      type: Number,
      default: 6,
      min: 1,
      max: 20,
    },
    // Analytics and tracking
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remindersSent: {
      type: Number,
      default: 0,
    },
    lastReminderSent: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes for better query performance
appointmentSchema.index({ therapistId: 1, date: 1, startTime: 1 })
appointmentSchema.index({ patientId: 1, date: 1 })
appointmentSchema.index({ status: 1, date: 1 })
appointmentSchema.index({ groupSessionId: 1 })
appointmentSchema.index({ isGroupSession: 1, date: 1 })

// Virtual for appointment duration
appointmentSchema.virtual("duration").get(function () {
  if (!this.startTime || !this.endTime) return 0

  const parseTime = (timeStr) => {
    const [time, period] = timeStr.split(" ")
    const [hours, minutes] = time.split(":").map(Number)
    let totalMinutes = hours * 60 + minutes
    if (period === "PM" && hours !== 12) totalMinutes += 12 * 60
    if (period === "AM" && hours === 12) totalMinutes -= 12 * 60
    return totalMinutes
  }

  const startMinutes = parseTime(this.startTime)
  const endMinutes = parseTime(this.endTime)
  return endMinutes - startMinutes
})

// Virtual for formatted date
appointmentSchema.virtual("formattedDate").get(function () {
  return this.date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
})

// Pre-save middleware
appointmentSchema.pre("save", function (next) {
  if (this.isModified()) {
    this.lastModifiedBy = this.createdBy
  }
  next()
})

// Static methods
appointmentSchema.statics.findByTherapist = function (therapistId, startDate, endDate) {
  const query = { therapistId }
  if (startDate && endDate) {
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) }
  }
  return this.find(query).populate("patientId serviceId")
}

appointmentSchema.statics.findByPatient = function (patientId, startDate, endDate) {
  const query = { patientId }
  if (startDate && endDate) {
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) }
  }
  return this.find(query).populate("therapistId serviceId")
}

appointmentSchema.statics.findGroupSessions = function (filters = {}) {
  const query = { isGroupSession: true, ...filters }
  return this.find(query)
    .populate("therapistId", "firstName lastName email")
    .populate("serviceId", "name category price duration")
    .sort({ date: 1, startTime: 1 })
}

appointmentSchema.statics.getConflicts = function (therapistId, date, startTime, endTime, excludeId = null) {
  const query = {
    therapistId,
    date: new Date(date),
    status: { $nin: ["cancelled", "no-show", "completed"] },
  }

  if (excludeId) {
    query._id = { $ne: excludeId }
  }

  return this.find(query).then((appointments) => {
    const parseTime = (timeStr) => {
      const [time, period] = timeStr.split(" ")
      const [hours, minutes] = time.split(":").map(Number)
      let totalMinutes = hours * 60 + minutes
      if (period === "PM" && hours !== 12) totalMinutes += 12 * 60
      if (period === "AM" && hours === 12) totalMinutes -= 12 * 60
      return totalMinutes
    }

    const newStartMinutes = parseTime(startTime)
    const newEndMinutes = parseTime(endTime)

    return appointments.filter((apt) => {
      const existingStartMinutes = parseTime(apt.startTime)
      const existingEndMinutes = parseTime(apt.endTime)

      // Check for time overlap
      return newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes
    })
  })
}

// Instance methods
appointmentSchema.methods.canBeRescheduled = function () {
  return ["scheduled", "confirmed"].includes(this.status) && this.date > new Date()
}

appointmentSchema.methods.canBeCancelled = function () {
  return ["scheduled", "confirmed"].includes(this.status)
}

appointmentSchema.methods.isUpcoming = function () {
  const now = new Date()
  const appointmentDateTime = new Date(this.date)
  return appointmentDateTime > now && this.status === "scheduled"
}

appointmentSchema.methods.markAsCompleted = function () {
  this.status = "completed"
  this.completedAt = new Date()
  return this.save()
}

appointmentSchema.methods.cancel = function (reason = "") {
  this.status = "cancelled"
  this.cancelledAt = new Date()
  if (reason) {
    this.notes = this.notes ? `${this.notes}\n\nCancellation reason: ${reason}` : `Cancellation reason: ${reason}`
  }
  return this.save()
}

module.exports = mongoose.model("Appointment", appointmentSchema)
