const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getRecentEmails,
  getAllEmails,
  getSingleEmail,
  sendRenewalReminder,
} = require("../controllers/emailController");

//Subscribed User
router.get("/recent", protect, getRecentEmails);
router.get("/", protect, getAllEmails);
router.get("/:id", protect, getSingleEmail);

//Admin: Send subscription renewal reminder to a specific user
router.post(
  "/send-renewal/:userId",
  protect,
  authorize("admin"),
  sendRenewalReminder
);

module.exports = router;
