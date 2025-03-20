const mongoose = require("mongoose");

const BlogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    content: {
      type: String,
      required: [true, "Please add content"],
    },
    author: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      name: String,
      bio: String,
      profilePicture: String,
    },
    category: {
      type: String,
      required: [true, "Please add a category"],
      enum: [
        "Parenting",
        "Child Development",
        "Therapy Tips",
        "Success Stories",
        "News",
        "Other",
      ],
    },
    tags: {
      type: [String],
      default: [],
    },
    featuredImage: {
      type: String,
      default:
        "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg",
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishDate: {
      type: Date,
      default: Date.now,
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    comments: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        name: String,
        comment: String,
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create slug from title
BlogSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-");
  }
  next();
});

// Populate author details before saving
BlogSchema.pre("save", async function (next) {
  if (this.isModified("author.userId")) {
    try {
      const User = mongoose.model("User");
      const user = await User.findById(this.author.userId);
      if (user) {
        this.author.name = `${user.firstName} ${user.lastName}`;
        this.author.profilePicture = user.profilePicture;
      }
    } catch (err) {
      console.error("Error populating author details:", err);
    }
  }
  next();
});

module.exports = mongoose.model("Blog", BlogSchema);
