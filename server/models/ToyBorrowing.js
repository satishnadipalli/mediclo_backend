const mongoose = require("mongoose");

const ToyBorrowingSchema = new mongoose.Schema(
  {
    toyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Toy",
      required: [true, "Toy ID is required"],
    },
    toyUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ToyUnit",
      required: [true, "Toy unit ID is required"],
    },
    borrowerName: {
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
    issueDate: {
      type: Date,
      required: [true, "Issue date is required"],
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    returnDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Borrowed", "Returned", "Overdue", "Lost", "Damaged"],
      default: "Borrowed",
    },
    conditionOnIssue: {
      type: String,
      enum: ["Excellent", "Good", "Fair", "Needs Repair", "Damaged"],
      default: "Good",
    },
    conditionOnReturn: {
      type: String,
      enum: ["Excellent", "Good", "Fair", "Needs Repair", "Damaged"],
    },
    notes: {
      type: String,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Issuer ID is required"],
    },
    returnProcessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Update toy unit availability and status when a toy is borrowed or returned
ToyBorrowingSchema.pre("save", async function (next) {
  try {
    const ToyUnit = mongoose.model("ToyUnit");
    const Toy = mongoose.model("Toy");

    // Get the corresponding toy unit
    const toyUnit = await ToyUnit.findById(this.toyUnitId);

    if (this.isNew) {
      // New borrowing record - update toy unit to unavailable
      await ToyUnit.updateOne(
        { _id: this.toyUnitId },
        {
          isAvailable: false,
          currentBorrower: this._id,
        }
      );
    } else if (this.isModified("returnDate") && this.returnDate) {
      // Toy returned - update toy unit to available and update condition
      await ToyUnit.updateOne(
        { _id: this.toyUnitId },
        {
          isAvailable: true,
          condition: this.conditionOnReturn || toyUnit.condition,
          currentBorrower: null,
        }
      );
    }

    // Update the available units count on the toy
    const toy = await Toy.findById(this.toyId);
    if (toy) {
      await toy.updateAvailableUnits();
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Automatically set status to "Overdue" if due date has passed
// ToyBorrowingSchema.pre("find", function () {
//   this.where({
//     returnDate: { $exists: false }, // Not yet returned
//     dueDate: { $lt: new Date() }, // Due date has passed
//     status: "Borrowed",
//   }).setOptions({ overwriteDiscriminatorKey: true });

//   this.updateMany({}, { status: "Overdue" }).exec();
// });

module.exports = mongoose.model("ToyBorrowing", ToyBorrowingSchema);
