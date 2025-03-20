const express = require("express");
const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  addCourseVideo,
  deleteCourseVideo,
  addCourseRating,
  getCourseRatings,
  updateCourseStatus,
  validateCourse,
  validateCourseVideo,
  validateCourseRating,
  validateCourseStatus,
} = require("../controllers/courseController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.get("/", getCourses);
router.get("/:id", getCourse);
router.get("/:id/ratings", getCourseRatings);

// Protected routes
router.use(protect);

// Admin only routes
router.post("/", authorize("admin"), validateCourse, createCourse);
router.put("/:id", authorize("admin"), validateCourse, updateCourse);
router.delete("/:id", authorize("admin"), deleteCourse);
router.post(
  "/:id/videos",
  authorize("admin"),
  validateCourseVideo,
  addCourseVideo
);
router.delete("/:id/videos/:videoId", authorize("admin"), deleteCourseVideo);
router.put(
  "/:id/status",
  authorize("admin"),
  validateCourseStatus,
  updateCourseStatus
);

// User routes (require authentication)
router.post("/:id/ratings", validateCourseRating, addCourseRating);

module.exports = router;
