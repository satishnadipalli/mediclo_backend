const mongoose = require("mongoose")

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
  },
)

// Your existing virtual for all toy units
ToySchema.virtual("units", {
  ref: "ToyUnit",
  localField: "_id",
  foreignField: "toyId",
  justOne: false,
})

// THIS IS THE VIRTUAL THAT MUST BE PRESENT FOR POPULATE TO WORK
ToySchema.virtual("availableUnitsDetails", {
  ref: "ToyUnit",
  localField: "_id",
  foreignField: "toyId",
  justOne: false,
  match: { isAvailable: true }, // Only include units that are available
  select: "unitNumber condition", // Only return unitNumber and condition
})

// --- DIAGNOSTIC LOG ---
// This log should appear in your server console when models/toy.js is loaded.
// It should say "true" if the virtual is correctly defined.
console.log("DEBUG: ToySchema virtual 'availableUnitsDetails' defined:", !!ToySchema.virtuals.availableUnitsDetails)
// --- END DIAGNOSTIC LOG ---

// Your existing method to update available units count
ToySchema.methods.updateAvailableUnits = async function () {
  const ToyUnit = mongoose.model("ToyUnit")
  const availableUnits = await ToyUnit.countDocuments({
    toyId: this._id,
    isAvailable: true,
  })
  this.availableUnits = availableUnits
  await this.save()
}

module.exports = mongoose.model("Toy", ToySchema)

