const express = require("express");
const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");
const {
  getTherapists,
  getTherapist,
  createTherapist,
  updateTherapist,
  deleteTherapist,
  getTherapistByUserId,
  createTherapistValidation,
  updateTherapistValidation,
} = require("../controllers/therapistController");

const router = express.Router();

// Public routes
router.get("/", getTherapists);
router.get("/:id", getTherapist);

// Protected routes
router.use(protect);

// Get therapist by user ID
router.get("/user/:userId", getTherapistByUserId);

// Create therapist profile - only therapists and admins can create
router.post(
  "/",
  authorize("admin", "therapist"),
  createTherapistValidation,
  createTherapist
);

// Update and delete therapist profile
router
  .route("/:id")
  .put(
    authorize("admin", "therapist"),
    updateTherapistValidation,
    updateTherapist
  )
  .delete(authorize("admin"), deleteTherapist);

module.exports = router;
