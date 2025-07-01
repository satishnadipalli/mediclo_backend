
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
  getToyUnits,
  getToyUnit,
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
  manualOverdueUpdate,
} = require("../controllers/toyBorrowingController");

// Setup routes

// Toy routes - admin/staff only
router
  .route("/")
  .get(protect, authorize("admin", "staff"), getToys)
  .post(protect, authorize("admin", "staff"), createToy);

router
  .route("/:id")
  .get(protect, authorize("admin", "staff"), getToy)
  .put(protect, authorize("admin", "staff"), updateToy)
  .delete(protect, authorize("admin"), deleteToy);

router.get("/categories", protect, authorize("admin", "staff"), getCategories);
router.get(
  "/:id/borrowing-history",
  protect,
  authorize("admin", "staff"),
  getToyBorrowingHistory
);
router.get(
  "/:id/available-units",
  protect,
  authorize("admin", "staff"),
  getAvailableToyUnits
);

// Toy unit routes - admin/staff only
router
  .route("/:toyId/units")
  .post(protect, authorize("admin", "staff"), addToyUnit);

router
  .route("/units/:id")
  .put(protect, authorize("admin", "staff"), updateToyUnit)
  .delete(protect, authorize("admin"), deleteToyUnit);

// Borrowing routes - admin/staff only
router
  .route("/borrowings",getActiveBorrowings)
  .post(protect, authorize("admin", "staff"), borrowToyValidation, issueToy);

router.get("/hi", async(req,res)=>{return "Hello"})

router.get(
  "/borrowings/overdue",
  protect,
  authorize("admin", "staff"),
  getOverdueBorrowings
);
router.get(
  "/borrowings/:id",
  protect,
  authorize("admin", "staff"),
  getBorrowing
);

router.put(
  "/borrowings/:id/return",
  protect,
  authorize("admin", "staff"),
  returnToyValidation,
  returnToy
);
router.put(
  "/borrowings/:id/status",
  protect,
  authorize("admin", "staff"),
  updateBorrowingStatus
);
router.get(
  "/borrowers/:email/history",
  protect,
  authorize("admin", "staff"),
  getBorrowerHistory
);

// New manual trigger route
router.put(
  "/borrowings/overdue/update",
  protect,
  authorize("admin", "staff"),
  manualOverdueUpdate
);



router.get("/:toyId/units", protect, authorize("admin", "staff"), getToyUnits)

router.get("/units/:id", protect, authorize("admin", "staff"), getToyUnit)

module.exports = router;
