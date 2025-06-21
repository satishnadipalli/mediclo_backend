const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "therapist", "staff", "receptionist", "parent", "member"],
      default: "parent",
    },
    firstName: {
      type: String,
      required: [true, "Please add a first name"],
    },
    lastName: {
      type: String,
      required: [true, "Please add a last name"],
    },
    phone: {
      type: String,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    dateOfBirth: {
      type: Date,
    },
    profilePicture: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Membership / Subscription details
    membership: {
      type: String,
      enum: ["basic plan", "advanced plan", "premium plan"],
      default: null,
    },
    subscriptionStart: {
      type: Date,
    },
    subscriptionEnd: {
      type: Date,
    },
    // E-commerce / order history (optional future field)
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Encrypt password using bcrypt
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Create full name virtual
UserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Cascade delete patients when a user is deleted
UserSchema.pre("remove", async function (next) {
  // Previously handled deleting patients for parent users,
  // check if this user is associated with any patients
  await this.model("Patient").updateMany(
    { userId: this._id },
    { $set: { userId: null } }
  );
  next();
});

module.exports = mongoose.model("User", UserSchema);
