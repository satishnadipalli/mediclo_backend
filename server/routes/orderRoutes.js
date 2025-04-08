const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
  getOrders,
  getOrder,
  updateOrderStatus,
  deleteOrder,
  processRefund,
  refundOrderValidation,
  submitPublicOrder,
  validatePublicOrder,
  checkPublicOrderStatus,
  validateDiscountCode,
  getActiveDiscounts,
} = require("../controllers/orderController");

const router = express.Router();

// Public order routes (no authentication required)
router.post("/public", validatePublicOrder, validateRequest, submitPublicOrder);
router.post("/public/validate-discount", validateDiscountCode);
router.get("/public/discounts", getActiveDiscounts);
router.get("/public/:id", checkPublicOrderStatus);

// Routes for admins
router.use(protect, authorize("admin"));
router.get("/", getOrders);
router.get("/:id", getOrder);
router.put("/:id/status", updateOrderStatus);
router.put("/:id/shipping", updateOrderStatus);
router.post(
  "/:id/refund",
  refundOrderValidation,
  validateRequest,
  processRefund
);
router.delete("/:id", deleteOrder);

module.exports = router;
