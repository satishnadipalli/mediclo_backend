const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getDiscounts,
  getDiscount,
  validateDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  createDiscountValidation,
  updateDiscountValidation,
} = require("../controllers/discountController");

const router = express.Router();

// Public routes
router.post("/validate", validateDiscount);

// Protected routes
router.use(protect);

// Admin routes
router.use(authorize("admin"));
router.get("/", getDiscounts);
router.get("/:id", getDiscount);
router.post("/", createDiscountValidation, createDiscount);
router.put("/:id", updateDiscountValidation, updateDiscount);
router.delete("/:id", deleteDiscount);

module.exports = router;
