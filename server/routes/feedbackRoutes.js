const express = require("express");
const {
  getAllFeedback,
  getMyFeedback,
  getFeedback,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  getItemFeedback,
  togglePublishStatus,
  validateFeedback,
} = require("../controllers/feedbackController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.get("/item/:itemType/:itemId", getItemFeedback);

// Protected routes
router.use(protect);

// User routes (require authentication)
router.get("/me", getMyFeedback);
router.post("/", validateFeedback, createFeedback);
router.put("/:id", validateFeedback, updateFeedback);
router.delete("/:id", deleteFeedback);

// Admin only routes
router.get("/", authorize("admin"), getAllFeedback);
router.get("/:id", authorize("admin"), getFeedback);
router.put("/:id/publish", authorize("admin"), togglePublishStatus);

module.exports = router;
