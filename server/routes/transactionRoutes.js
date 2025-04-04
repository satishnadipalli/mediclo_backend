const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getTransactions,
  getUserTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  processRefund,
  createTransactionValidation,
  updateTransactionValidation,
} = require("../controllers/transactionController");

const router = express.Router();

// All transaction routes are protected and admin-only
router.use(protect, authorize("admin"));

// Admin only routes
router.get("/", getTransactions);
router.get("/user/:userId", getUserTransactions);
router.get("/:id", getTransaction);
router.post("/", createTransactionValidation, createTransaction);
router.put("/:id", updateTransactionValidation, updateTransaction);
router.post("/:id/refund", processRefund);

// No longer needed as we're making all routes admin-only
// router.get("/user", getUserTransactions);

module.exports = router;
