const mongoose = require("mongoose");

const BorrowerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Borrower name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
      trim: true,
    },
    relationship: {
      type: String,
      enum: ["Father", "Mother", "Guardian", "Other"],
      required: [true, "Relationship to child is required"],
    },
    address: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create index for email to ensure quick lookups
BorrowerSchema.index({ email: 1 });
BorrowerSchema.index({ phone: 1 });

// Virtual for borrowing history
BorrowerSchema.virtual("borrowings", {
  ref: "ToyBorrowing",
  localField: "email",
  foreignField: "email",
  justOne: false,
});

// Calculate if borrower has any active borrowings
BorrowerSchema.virtual("hasActiveBorrowings").get(async function () {
  const ToyBorrowing = mongoose.model("ToyBorrowing");
  const count = await ToyBorrowing.countDocuments({
    email: this.email,
    returnDate: { $exists: false },
  });
  return count > 0;
});

// Calculate if borrower has any overdue borrowings
BorrowerSchema.virtual("hasOverdueBorrowings").get(async function () {
  const ToyBorrowing = mongoose.model("ToyBorrowing");
  const count = await ToyBorrowing.countDocuments({
    email: this.email,
    returnDate: { $exists: false },
    dueDate: { $lt: new Date() },
  });
  return count > 0;
});

module.exports = mongoose.model("Borrower", BorrowerSchema);
