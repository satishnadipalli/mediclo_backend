const express = require("express");
const {
  getWebinars,
  getWebinar,
  createWebinar,
  updateWebinar,
  deleteWebinar,
  registerForWebinar,
  cancelRegistration,
  getWebinarRegistrations,
  updateWebinarStatus,
  addWebinarRating,
  getUpcomingWebinars,
  validateWebinar,
  validateWebinarRating,
  validateWebinarStatus,
} = require("../controllers/webinarController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.get("/", getWebinars);
router.get("/upcoming", getUpcomingWebinars);
router.get("/:id", getWebinar);

// Protected routes
router.use(protect);

// User routes (require authentication)
router.post("/:id/register", registerForWebinar);
router.delete("/:id/register", cancelRegistration);
router.post("/:id/ratings", validateWebinarRating, addWebinarRating);

// Admin only routes
router.post("/", authorize("admin"), validateWebinar, createWebinar);
router.put("/:id", authorize("admin"), validateWebinar, updateWebinar);
router.delete("/:id", authorize("admin"), deleteWebinar);
router.get("/:id/registrations", authorize("admin"), getWebinarRegistrations);
router.put(
  "/:id/status",
  authorize("admin"),
  validateWebinarStatus,
  updateWebinarStatus
);

module.exports = router;
