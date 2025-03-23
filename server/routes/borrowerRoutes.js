const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");

// Import controllers
const {
  getBorrowers,
  getBorrower,
  createBorrower,
  updateBorrower,
  deleteBorrower,
  getBorrowerStats,
  borrowerValidation,
} = require("../controllers/borrowerController");

// Setup routes
router
  .route("/")
  .get(protect, getBorrowers)
  .post(protect, borrowerValidation, createBorrower);

router
  .route("/:id")
  .get(protect, getBorrower)
  .put(protect, borrowerValidation, updateBorrower)
  .delete(protect, authorize("admin", "staff"), deleteBorrower);

router.get("/stats", protect, authorize("admin", "staff"), getBorrowerStats);

module.exports = router;
