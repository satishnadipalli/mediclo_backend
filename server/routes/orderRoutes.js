const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getOrders,
  getUserOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  processRefund,
  createOrderValidation,
  updateOrderValidation,
  refundOrderValidation,
} = require("../controllers/orderController");

const router = express.Router();

// All order routes are protected
router.use(protect);

// Routes for all authenticated users
router.get("/user", getUserOrders);
router.get("/myorders", getUserOrders);
router.post("/", createOrderValidation, createOrder);

// Important: Put specific routes like /user and /myorders BEFORE the /:id route
// to avoid treating them as IDs
router.get("/:id", getOrder);

// Routes for admins
router.use(authorize("admin"));
router.get("/", getOrders);
router.put("/:id/status", updateOrderStatus);
router.post("/:id/refund", refundOrderValidation, processRefund);
router.delete("/:id", deleteOrder);

module.exports = router;
