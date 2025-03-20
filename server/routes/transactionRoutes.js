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

// All transaction routes are protected
router.use(protect);

// Routes for all authenticated users
router.get("/user", getUserTransactions);
router.get("/:id", getTransaction);

// Routes for admins
router.use(authorize("admin"));
router.get("/", getTransactions);
router.post("/", createTransactionValidation, createTransaction);
router.put("/:id", updateTransactionValidation, updateTransaction);
router.post("/:id/refund", processRefund);

module.exports = router;
