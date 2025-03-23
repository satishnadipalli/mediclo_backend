const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");

// Import controllers
const {
  getToys,
  getToy,
  createToy,
  updateToy,
  deleteToy,
  addToyUnit,
  updateToyUnit,
  deleteToyUnit,
  getToyBorrowingHistory,
  getCategories,
} = require("../controllers/toyController");

const {
  getActiveBorrowings,
  getBorrowing,
  issueToy,
  returnToy,
  updateBorrowingStatus,
  getOverdueBorrowings,
  getAvailableToyUnits,
  borrowToyValidation,
  returnToyValidation,
  getBorrowerHistory,
} = require("../controllers/toyBorrowingController");

// Setup routes

// Toy routes
router
  .route("/")
  .get(protect, getToys)
  .post(protect, authorize("admin", "staff"), createToy);

router
  .route("/:id")
  .get(protect, getToy)
  .put(protect, authorize("admin", "staff"), updateToy)
  .delete(protect, authorize("admin"), deleteToy);

router.get("/categories", protect, getCategories);
router.get("/:id/borrowing-history", protect, getToyBorrowingHistory);
router.get("/:id/available-units", protect, getAvailableToyUnits);

// Toy unit routes
router
  .route("/:toyId/units")
  .post(protect, authorize("admin", "staff"), addToyUnit);

router
  .route("/units/:id")
  .put(protect, authorize("admin", "staff"), updateToyUnit)
  .delete(protect, authorize("admin"), deleteToyUnit);

// Borrowing routes
router
  .route("/borrowings")
  .get(protect, getActiveBorrowings)
  .post(protect, borrowToyValidation, issueToy);

router.get("/borrowings/overdue", protect, getOverdueBorrowings);
router.get("/borrowings/:id", protect, getBorrowing);
router.put("/borrowings/:id/return", protect, returnToyValidation, returnToy);
router.put("/borrowings/:id/status", protect, updateBorrowingStatus);
router.get("/borrowers/:email/history", protect, getBorrowerHistory);

module.exports = router;
