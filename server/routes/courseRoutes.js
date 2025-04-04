const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  addCourseVideo,
  deleteCourseVideo,
  updateCourseStatus,
  validateCourse,
  validateCourseVideo,
  validateCourseStatus,
  enrollPublicInCourse,
} = require("../controllers/courseController");

// Public routes - no authentication required
router.get("/", getCourses);
router.get("/:id", getCourse);

// Public enrollment endpoint
router.post("/public/enroll/:id", enrollPublicInCourse);

// Protected routes
router.use(protect);

// Admin only routes
router.use(authorize("admin"));

// Course CRUD
router.post("/", validateCourse, createCourse);
router.put("/:id", validateCourse, updateCourse);
router.delete("/:id", deleteCourse);

// Course videos
router.post("/:id/videos", validateCourseVideo, addCourseVideo);
router.delete("/:id/videos/:videoId", deleteCourseVideo);

// Course status
router.put("/:id/status", validateCourseStatus, updateCourseStatus);

module.exports = router;
