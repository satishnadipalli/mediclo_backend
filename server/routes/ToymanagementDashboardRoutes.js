const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const { smartSearch, processReturnValidation, processMultipleReturns } = require("../controllers/borrowerController");
const router = express.Router();

const { ToyStats, getBorrowedToys, sendRemainder, getBorrowingById, getToyDetails, getAllBorrowers, getBorrowerByEmail, sendRemainderToEmail, getBorrowersById, sendRemainderByBororrwerId, getActiveBorrowings } = require("../controllers/ToyManagementDashboardControllers");
const { getAvailableToyUnits } = require("../controllers/toyBorrowingController");


router.get("/process-return/smart-search", protect, authorize("admin", "staff"), smartSearch)
router.get("/dashboard/stats", ToyStats)

router.post("/process-return/process-multiple",protect,authorize("admin", "staff"),processReturnValidation,processMultipleReturns,)

router.get("/dashboard/borrowed-toys",getBorrowedToys);

router.post("/dashboard/send-reminder", sendRemainder);

router.put("/dashboard/process-return/:borrowingId", getBorrowingById);

// GET /api/toys/:toyId/available-units - Get available units for a specific toy
router.get("/toys/:toyId/available-units", getAvailableToyUnits);

router.get("/toys/:toyId/details", getToyDetails)

// GET /api/borrowers - Get all borrowers with their current borrowings
router.get("/borrowers", getAllBorrowers)

// GET /api/borrowers/:borrowerEmail - Get specific borrower details
router.get("/borrowers/:borrowerEmail", getBorrowerByEmail)

// POST /api/borrowers/:borrowerEmail/send-reminder - Send reminder to specific borrower
router.post("/borrowers/:borrowerEmail/send-reminder", sendRemainderToEmail);


router.get("/borrowerss/:borrowerId", getBorrowersById);

router.post("/borrowers/:borrowerId/send-reminder", sendRemainderByBororrwerId);

router.get("/process-return/active-borrowings", protect, authorize("admin", "staff"), getActiveBorrowings);


module.exports = router;