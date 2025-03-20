const express = require("express");
const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");
const {
  getApplications,
  getUserApplications,
  getApplication,
  updateApplicationStatus,
  deleteApplication,
  updateApplicationStatusValidation,
} = require("../controllers/jobApplicationController");

const router = express.Router();

// Protected routes
router.use(protect);

// Get user's applications
router.get("/me", getUserApplications);

// Get single application
router.get("/:id", getApplication);

// Delete application
router.delete("/:id", deleteApplication);

// Admin only routes
router.get("/", authorize("admin"), getApplications);

router.put(
  "/:id/status",
  authorize("admin"),
  updateApplicationStatusValidation,
  updateApplicationStatus
);

module.exports = router;
