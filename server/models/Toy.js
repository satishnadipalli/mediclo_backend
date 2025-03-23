const mongoose = require("mongoose");

const ToySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Toy name is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    totalUnits: {
      type: Number,
      default: 0,
    },
    availableUnits: {
      type: Number,
      default: 0,
    },
    image: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
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

// Virtual for toy units
ToySchema.virtual("units", {
  ref: "ToyUnit",
  localField: "_id",
  foreignField: "toyId",
  justOne: false,
});

// Update available units count when adding or removing units
ToySchema.methods.updateAvailableUnits = async function () {
  const ToyUnit = mongoose.model("ToyUnit");
  const availableUnits = await ToyUnit.countDocuments({
    toyId: this._id,
    isAvailable: true,
  });
  this.availableUnits = availableUnits;
  await this.save();
};

module.exports = mongoose.model("Toy", ToySchema);
