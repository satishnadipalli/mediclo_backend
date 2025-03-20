const mongoose = require("mongoose");

const InventorySchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productName: {
    type: String,
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  barcode: {
    type: String,
    trim: true,
    unique: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  reservedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  lowStockThreshold: {
    type: Number,
    default: 5,
  },
  location: {
    type: String,
    default: "Main Warehouse",
  },
  lastRestocked: {
    type: Date,
    default: Date.now,
  },
  stockUpdates: [
    {
      previousStock: Number,
      newStock: Number,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      updateDate: {
        type: Date,
        default: Date.now,
      },
      notes: String,
    },
  ],
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on update and populate productName
InventorySchema.pre("save", async function (next) {
  this.updatedAt = Date.now();

  // If productName is not set, populate it from the product
  if (!this.productName && this.product) {
    try {
      const Product = mongoose.model("Product");
      const productDoc = await Product.findById(this.product);
      if (productDoc) {
        this.productName = productDoc.name;
      }
    } catch (err) {
      console.error("Error populating productName:", err);
    }
  }

  next();
});

// Method to check if product is in stock
InventorySchema.methods.isInStock = function () {
  return this.quantity > this.reservedQuantity;
};

// Method to check if product is low in stock
InventorySchema.methods.isLowStock = function () {
  return this.quantity - this.reservedQuantity <= this.lowStockThreshold;
};

// Method to update stock
InventorySchema.methods.updateStock = function (
  newQuantity,
  userId,
  notes = ""
) {
  const previousStock = this.quantity;
  this.quantity = newQuantity;

  this.stockUpdates.push({
    previousStock,
    newStock: newQuantity,
    updatedBy: userId,
    updateDate: new Date(),
    notes,
  });

  return this.save();
};

// Indexes
InventorySchema.index({ product: 1 });

module.exports = mongoose.model("Inventory", InventorySchema);
