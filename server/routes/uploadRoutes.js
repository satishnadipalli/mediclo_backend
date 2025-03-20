const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  productImageUpload,
  categoryImageUpload,
  blogImageUpload,
  courseThumbnailUpload,
  courseVideoUpload,
  webinarThumbnailUpload,
} = require("../config/cloudinary");
const {
  uploadProductImage,
  uploadCategoryImage,
  uploadBlogImage,
  uploadCourseThumbnail,
  uploadCourseVideo,
  uploadWebinarThumbnail,
} = require("../controllers/uploadController");

const router = express.Router();

// All upload routes are protected
router.use(protect);
router.use(authorize("admin"));

// Blog image upload route
router.post(
  "/blog",
  authorize("admin", "therapist"),
  (req, res, next) => {
    blogImageUpload.single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
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

module.exports = router;
