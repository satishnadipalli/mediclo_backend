const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getApplications,
  getUserApplications,
  getApplication,
  updateApplicationStatus,
  deleteApplication,
  updateApplicationStatusValidation,
  submitPublicJobApplication,
  checkPublicApplicationStatus,
} = require("../controllers/jobApplicationController");

const router = express.Router();

// Public endpoints
router.post("/public/:jobId", submitPublicJobApplication);
router.get("/public/status/:id", checkPublicApplicationStatus);

// Protected admin-only routes
router.use(protect, authorize("admin"));

// Admin only routes
router.get("/", getApplications);
router.get("/:id", getApplication);
router.delete("/:id", deleteApplication);
router.put(
  "/:id/status",
  updateApplicationStatusValidation,
  updateApplicationStatus
);

// Remove user-specific routes
// router.get("/me", getUserApplications);

module.exports = router;
