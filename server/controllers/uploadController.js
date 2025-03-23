const ErrorResponse = require("../utils/errorResponse");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// @desc    Upload image to Cloudinary
// @route   POST /api/upload
// @access  Private/Admin/Therapist
exports.uploadBlogImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a file",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
        public_id: req.file.filename, // The public_id is typically the filename in Cloudinary
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @desc    Upload product image
// @route   POST /api/upload/product
// @access  Private/Admin
exports.uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a file",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload category image
// @route   POST /api/upload/category
// @access  Private/Admin
exports.uploadCategoryImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a file",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload course thumbnail
// @route   POST /api/upload/course/thumbnail
// @access  Private/Admin
exports.uploadCourseThumbnail = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a course thumbnail",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload course video
// @route   POST /api/upload/course/video
// @access  Private/Admin
exports.uploadCourseVideo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a course video",
      });
    }

    // Handle video upload to file storage or cloud storage
    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
        filesize: req.file.size,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload webinar thumbnail
// @route   POST /api/upload/webinar/thumbnail
// @access  Private/Admin
exports.uploadWebinarThumbnail = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a webinar thumbnail",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Configure storage for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads/toys");

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "toy-" + uniqueSuffix + ext);
  },
});

// File filter for image types
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;

  // Check extension
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  // Check mime type
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

// Initialize multer upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
});

// Error handling for multer
const handleMulterErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File size should not exceed 5MB",
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  next();
};

// @desc    Upload toy image
// @route   POST /api/upload/toy
// @access  Private
exports.uploadToyImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload an image file",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        public_id: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete toy image
// @route   DELETE /api/upload/toy/:public_id
// @access  Private
exports.deleteToyImage = async (req, res, next) => {
  try {
    const { cloudinary } = require("../config/cloudinary");
    const public_id = req.params.public_id;

    const result = await cloudinary.uploader.destroy(public_id);

    if (result.result !== "ok") {
      return res.status(400).json({
        success: false,
        error: "Failed to delete image",
      });
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload patient photo
// @route   POST /api/upload/patient/photo
// @access  Private/Therapist
exports.uploadPatientPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a photo",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        public_id: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload parent photo
// @route   POST /api/upload/patient/parent-photo
// @access  Private/Therapist
exports.uploadParentPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a photo",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        public_id: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload birth certificate
// @route   POST /api/upload/patient/birth-certificate
// @access  Private/Therapist
exports.uploadBirthCertificate = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a birth certificate document",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        public_id: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload aadhar card
// @route   POST /api/upload/patient/aadhar-card
// @access  Private/Therapist
exports.uploadAadharCard = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload an aadhar card document",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        public_id: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload medical records
// @route   POST /api/upload/patient/medical-records
// @access  Private/Therapist
exports.uploadMedicalRecords = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a medical record document",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        public_id: req.file.filename,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete document from cloudinary
// @route   DELETE /api/upload/document/:public_id
// @access  Private/Therapist
exports.deleteDocument = async (req, res, next) => {
  try {
    const { cloudinary } = require("../config/cloudinary");
    const public_id = req.params.public_id;

    const result = await cloudinary.uploader.destroy(public_id);

    if (result.result !== "ok") {
      return res.status(400).json({
        success: false,
        error: "Failed to delete document",
      });
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload gallery image
// @route   POST /api/upload/gallery
// @access  Private/Admin
exports.uploadGalleryImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload an image file",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
        public_id: req.file.filename,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @desc    Upload disease image
// @route   POST /api/upload/disease
// @access  Private/Admin
exports.uploadDiseaseImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload an image file",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
        public_id: req.file.filename,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @desc    Upload resume document
// @route   POST /api/upload/resume
// @access  Public (but can be protected in the route)
exports.uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a resume file",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
        public_id: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
      },
    });
  } catch (err) {
    console.log("Resume upload error:", err);
    next(err);
  }
};
