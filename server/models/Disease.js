const mongoose = require("mongoose");

const DiseaseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a disease name"],
      trim: true,
      maxlength: [100, "Name cannot be more than 100 characters"],
      unique: true,
    },
    description: {
      type: String,
      required: [true, "Please add a description"],
    },
    symptoms: {
      type: [String],
      required: [true, "Please add symptoms"],
    },
    causes: {
      type: String,
      required: [true, "Please add causes"],
    },
    diagnosis: {
      type: String,
      required: [true, "Please add diagnosis information"],
    },
    treatments: {
      type: String,
      required: [true, "Please add treatment information"],
    },
    preventions: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      required: [true, "Please add a category"],
      enum: [
        "Developmental Disorder",
        "Learning Disability",
        "Behavioral Disorder",
        "Speech and Language Disorder",
        "Neurological Disorder",
        "Physical Disability",
        "Other",
      ],
    },
    ageGroup: {
      type: [String],
      default: [],
      enum: [
        "Infant (0-1 year)",
        "Toddler (1-3 years)",
        "Preschool (3-5 years)",
        "School Age (5-12 years)",
        "Adolescent (12-18 years)",
        "Adult (18+ years)",
      ],
    },
    featuredImage: {
      type: String,
      default: "",
    },
    additionalImages: {
      type: [String],
      default: [],
    },
    resources: [
      {
        title: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          required: true,
          enum: ["Website", "PDF", "Video", "Book", "Other"],
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    slug: String,
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create slug from name
DiseaseSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-");
  }

  // If metaTitle or metaDescription are not provided, use name and description
  if (!this.metaTitle) {
    this.metaTitle = this.name;
  }

  if (!this.metaDescription) {
    // Truncate description to 160 characters for meta description
    this.metaDescription = this.description.slice(0, 157) + "...";
  }

  next();
});

module.exports = mongoose.model("Disease", DiseaseSchema);
