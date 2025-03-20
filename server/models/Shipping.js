const mongoose = require("mongoose");

const ShippingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  estimatedDeliveryDays: {
    min: {
      type: Number,
      required: true,
    },
    max: {
      type: Number,
      required: true,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
  },
  orderNumber: String,
  customerName: String,
  customerAddress: String,
  shippingCode: {
    type: String,
    default: "TINK-",
  },
  trackingNumber: {
    type: String,
    default: null,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  assignedToName: String,
  shippingDate: {
    type: Date,
    default: null,
  },
  deliveryDate: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "shipped", "delivered", "cancelled"],
    default: "pending",
  },
  statusHistory: [
    {
      status: {
        type: String,
        enum: ["pending", "shipped", "delivered", "cancelled"],
      },
      date: {
        type: Date,
        default: Date.now,
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      notes: String,
    },
  ],
  regions: [
    {
      country: {
        type: String,
        required: true,
      },
      states: [String],
      additionalPrice: {
        type: Number,
        default: 0,
      },
    },
  ],
  freeShippingThreshold: {
    type: Number,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on update
ShippingSchema.pre("save", async function (next) {
  this.updatedAt = Date.now();

  // Generate tracking number if shipping is being marked as shipped
  if (this.status === "shipped" && !this.trackingNumber) {
    const randomId = Math.floor(10000 + Math.random() * 90000);
    this.trackingNumber = `${this.shippingCode}${randomId}`;
    this.shippingDate = new Date();
  }

  // Update delivery date if marked as delivered
  if (this.status === "delivered" && !this.deliveryDate) {
    this.deliveryDate = new Date();
  }

  // Populate assignedToName if it's not set
  if (this.assignedTo && !this.assignedToName) {
    try {
      const User = mongoose.model("User");
      const user = await User.findById(this.assignedTo);
      if (user) {
        this.assignedToName = `${user.firstName} ${user.lastName}`;
      }
    } catch (err) {
      console.error("Error populating assignedToName:", err);
    }
  }

  // Add status change to history if status has changed
  if (this.isModified("status")) {
    this.statusHistory.push({
      status: this.status,
      date: new Date(),
      updatedBy: this._updatedBy || null,
      notes: this._statusNotes || null,
    });
  }

  next();
});

// Set updatedBy and notes temporarily to be used in pre-save hook
ShippingSchema.methods.setStatusChange = function (status, userId, notes) {
  this.status = status;
  this._updatedBy = userId;
  this._statusNotes = notes;
  return this;
};

// Method to calculate shipping cost
ShippingSchema.methods.calculateCost = function (subtotal, country, state) {
  // Check if order qualifies for free shipping
  if (
    this.freeShippingThreshold !== null &&
    subtotal >= this.freeShippingThreshold
  ) {
    return 0;
  }

  let cost = this.price;

  // Add regional costs if applicable
  const region = this.regions.find((r) => r.country === country);
  if (region) {
    cost += region.additionalPrice;

    // Check for state-specific pricing (future enhancement)
  }

  return cost;
};

// Indexes
ShippingSchema.index({ isActive: 1 });
ShippingSchema.index({ "regions.country": 1 });
ShippingSchema.index({ status: 1 });
ShippingSchema.index({ trackingNumber: 1 });
ShippingSchema.index({ assignedTo: 1 });
ShippingSchema.index({ order: 1 });
ShippingSchema.index({ orderNumber: 1 });

module.exports = mongoose.model("Shipping", ShippingSchema);
