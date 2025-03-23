const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  productImageUpload,
  categoryImageUpload,
  blogImageUpload,
  courseThumbnailUpload,
  courseVideoUpload,
  webinarThumbnailUpload,
  toyImageUpload,
  patientPhotoUpload,
  parentPhotoUpload,
  birthCertificateUpload,
  aadharCardUpload,
  medicalRecordsUpload,
  galleryImageUpload,
  diseaseImageUpload,
  resumeUpload,
} = require("../config/cloudinary");
const {
  uploadProductImage,
  uploadCategoryImage,
  uploadBlogImage,
  uploadCourseThumbnail,
  uploadCourseVideo,
  uploadWebinarThumbnail,
  uploadToyImage,
  deleteToyImage,
  uploadPatientPhoto,
  uploadParentPhoto,
  uploadBirthCertificate,
  uploadAadharCard,
  uploadMedicalRecords,
  deleteDocument,
  uploadGalleryImage,
  uploadDiseaseImage,
  uploadResume,
} = require("../controllers/uploadController");

const router = express.Router();

// Resume upload route - this one is public for job applications
router.post(
  "/resume",
  (req, res, next) => {
    resumeUpload.single("resume")(req, res, (err) => {
      if (err) {
        console.log("Resume upload error:", err);
        return res.status(400).json({
          success: false,
          error: err.message,
          details: err.code || "No error code provided",
        });
      }

      // Check if file exists
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file received or file was empty",
        });
      }

      next();
    });
  },
  uploadResume
);

// All other upload routes are protected
router.use(protect);
router.use(authorize("admin"));

// Blog image upload route
router.post(
  "/blog",
  authorize("admin", "therapist"),
  (req, res, next) => {
    blogImageUpload.single("image")(req, res, (err) => {
      if (err) {
        console.log("Blog upload error:", err);
        return res.status(400).json({
          success: false,
          error: err.message,
          details: err.code || "No error code provided",
        });
      }

      // Check if file exists
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file received or file was empty",
        });
      }

      next();
    });
  },
  uploadBlogImage
);

// Product image upload route
router.post(
  "/product",
  (req, res, next) => {
    productImageUpload.single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  uploadProductImage
);

// Category image upload route
router.post(
  "/category",
  (req, res, next) => {
    categoryImageUpload.single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  uploadCategoryImage
);

// Course thumbnail upload route
router.post(
  "/course/thumbnail",
  (req, res, next) => {
    courseThumbnailUpload.single("thumbnail")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  uploadCourseThumbnail
);

// Course video upload route
router.post(
  "/course/video",
  (req, res, next) => {
    courseVideoUpload.single("video")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  uploadCourseVideo
);

// Webinar thumbnail upload route
router.post(
  "/webinar/thumbnail",
  (req, res, next) => {
    webinarThumbnailUpload.single("thumbnail")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  uploadWebinarThumbnail
);

// Toy image upload routes
router.post(
  "/toy",
  protect,
  authorize("admin", "staff"),
  (req, res, next) => {
    toyImageUpload.single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  uploadToyImage
);

router.delete(
  "/toy/:public_id",
  protect,
  authorize("admin", "staff"),
  deleteToyImage
);

// Patient document upload routes
router.post(
  "/patient/photo",
  protect,
  authorize("admin", "staff", "receptionist"),
  (req, res, next) => {
    patientPhotoUpload.single("photo")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  uploadPatientPhoto
);

router.post(
  "/patient/parent-photo",
  protect,
  authorize("admin", "staff", "receptionist"),
  (req, res, next) => {
    parentPhotoUpload.single("photo")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  uploadParentPhoto
);

router.post(
  "/patient/birth-certificate",
  protect,
  authorize("admin", "staff", "receptionist"),
  (req, res, next) => {
    birthCertificateUpload.single("certificate")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  uploadBirthCertificate
);

router.post(
  "/patient/aadhar-card",
  protect,
  authorize("admin", "staff", "receptionist"),
  (req, res, next) => {
    aadharCardUpload.single("aadhar")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  uploadAadharCard
);

router.post(
  "/patient/medical-records",
  protect,
  authorize("admin", "staff", "receptionist", "therapist"),
  (req, res, next) => {
    medicalRecordsUpload.single("record")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  uploadMedicalRecords
);

// Generic document delete route
router.delete(
  "/document/:public_id",
  protect,
  authorize("admin", "staff", "receptionist"),
  deleteDocument
);

// Gallery image upload route
router.post(
  "/gallery",
  protect,
  authorize("admin"),
  (req, res, next) => {
    galleryImageUpload.single("image")(req, res, (err) => {
      if (err) {
        console.log("Gallery upload error:", err);
        return res.status(400).json({
          success: false,
          error: err.message,
          details: err.code || "No error code provided",
        });
      }

      // Check if file exists
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file received or file was empty",
        });
      }

      next();
    });
  },
  uploadGalleryImage
);

// Disease image upload route
router.post(
  "/disease",
  protect,
  authorize("admin"),
  (req, res, next) => {
    diseaseImageUpload.single("image")(req, res, (err) => {
      if (err) {
        console.log("Disease upload error:", err);
        return res.status(400).json({
          success: false,
          error: err.message,
          details: err.code || "No error code provided",
        });
      }

      // Check if file exists
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file received or file was empty",
        });
      }

      next();
    });
  },
  uploadDiseaseImage
);

module.exports = router;
