const express = require("express");
const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");
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
  createApplication,
  getJobApplications,
  createApplicationValidation,
} = require("../controllers/jobApplicationController");

const { resumeUpload } = require("../config/cloudinary");

const router = express.Router();

// Public routes
router.get("/", getJobs);
router.get("/:id", getJob);
router.get("/department/:department", getJobsByDepartment);

// Protected routes
router.use(protect);

// Admin routes
router.post("/", authorize("admin"), createJobValidation, createJob);

router.put("/:id", authorize("admin"), updateJobValidation, updateJob);

router.delete("/:id", authorize("admin"), deleteJob);

// Get applications for a specific job (admin only)
router.get("/:jobId/applications", authorize("admin"), getJobApplications);

// Apply for a job
router.post(
  "/:jobId/apply",
  resumeUpload.single("resume"),
  createApplicationValidation,
  createApplication
);

module.exports = router;
