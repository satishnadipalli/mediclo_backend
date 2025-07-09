const express = require("express");
const {
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  getAllWorkshops,
  getUserWorkshops,
  getSingleWorkshop,
  validateWorkshop,
  registerForWorkshop,
  getSingleWorkshopAdmin,
} = require("../controllers/workshopController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Admin-only routes (STATIC FIRST)
router.get("/all", protect, authorize("admin"), getAllWorkshops);
router.get("/admin/:id", protect, authorize("admin"), getSingleWorkshopAdmin);
router.post("/", protect, authorize("admin"), validateWorkshop, createWorkshop);
router.put("/:id", protect, authorize("admin"), updateWorkshop);
router.delete("/:id", protect, authorize("admin"), deleteWorkshop);

// Subscribed users
router.get("/", protect, getUserWorkshops);
router.get("/:id", protect, getSingleWorkshop);
router.post("/:id/register", protect, registerForWorkshop);

module.exports = router;
