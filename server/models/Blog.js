const mongoose = require("mongoose");

const BlogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot be more than 500 characters"],
    },
    content: {
      type: String,
      required: [true, "Please add content"],
    },
    author: {
      type: String,
      default: "Dr. Shrruti Patil, Pediatric Occupational",
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
      default: true,
    },
    publishDate: {
      type: Date,
      default: Date.now,
    },
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

module.exports = mongoose.model("Blog", BlogSchema);
