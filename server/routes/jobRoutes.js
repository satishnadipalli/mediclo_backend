const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  getJobsByDepartment,
  createJobValidation,
  updateJobValidation,
} = require("../controllers/jobController");

const {
  getJobApplications,
} = require("../controllers/jobApplicationController");

const router = express.Router();

// Public routes - no authentication required
router.get("/", getJobs);
router.get("/:id", getJob);
router.get("/department/:department", getJobsByDepartment);

// Note: job applications are now handled in publicJobController

// Admin routes - still require authentication
router.post("/", protect, authorize("admin"), createJobValidation, createJob);
router.put("/:id", protect, authorize("admin"), updateJobValidation, updateJob);
router.delete("/:id", protect, authorize("admin"), deleteJob);

// Get applications for a specific job (admin only)
router.get(
  "/:jobId/applications",
  protect,
  authorize("admin"),
  getJobApplications
);

module.exports = router;
