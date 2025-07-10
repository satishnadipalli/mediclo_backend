const express = require("express")
const router = express.Router()
const {createSubscriptionPayment, createProductPayment, verifyProductPayment} = require("../controllers/paymentControllers")
const { protect } = require("../middleware/authMiddleware")

// All payment routes require authentication
router.use(protect)

// Create payment order for subscription
router.post("/subscription",createSubscriptionPayment);


// Product payment routes (public - no auth required for toy purchases)
router.post("/product", createProductPayment)
router.post("/product/verify", verifyProductPayment)

module.exports = router
