const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getTherapists,
  getTherapist,
  createTherapist,
  updateTherapist,
  deleteTherapist,
  getTherapistByUserId,
  createTherapistValidation,
  updateTherapistValidation,
  getAvailableTherapists,
} = require("../controllers/therapistController");

const router = express.Router();

// Public routes
router.get("/", getTherapists);
router.get("/available", getAvailableTherapists);
router.get("/:id", getTherapist);

// Protected admin-only routes
router.use(protect, authorize("admin"));

// Get therapist by user ID - admin only
router.get("/user/:userId", getTherapistByUserId);

// Create therapist profile - admin only
router.post("/", createTherapistValidation, createTherapist);

// Update and delete therapist profile - admin only
router
  .route("/:id")
  .put(updateTherapistValidation, updateTherapist)
  .delete(deleteTherapist);

module.exports = router;
