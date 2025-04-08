const express = require("express");
const {
  getWebinars,
  getUpcomingWebinars,
  getWebinar,
  createWebinar,
  updateWebinar,
  deleteWebinar,
  updateWebinarStatus,
  getWebinarRegistrations,
  registerPublicForWebinar,
  validatePublicRegistration,
  markAttendance,
  validateWebinar,
  validateWebinarStatus,
  deleteWebinarRegistration
} = require("../controllers/webinarController");

const router = express.Router();

const { protect, authorize } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");

// Public routes
router.get("/", getWebinars);
router.get("/upcoming", getUpcomingWebinars);
router.get("/:id", getWebinar);
router.post(
  "/public/register/:id",
  validatePublicRegistration,
  validateRequest,
  registerPublicForWebinar
);

// Admin-only routes
router.post("/", protect, authorize("admin"), validateWebinar, createWebinar);
router.put("/:id", protect, authorize("admin"), validateWebinar, updateWebinar);
router.delete("/:id", protect, authorize("admin"), deleteWebinar);
router.put(
  "/:id/status",
  protect,
  authorize("admin"),
  validateWebinarStatus,
  updateWebinarStatus
);
router.get(
  "/:id/registrations",
  protect,
  authorize("admin"),
  getWebinarRegistrations
);
router.delete(
  "/:webinarId/registrations/:id",
  protect,
  authorize("admin"),
  deleteWebinarRegistration
);

//router.put(
//  "/:webinarId/registrations/:id/attend",
//  protect,
//  authorize("admin"),
//  markAttendance
//);

module.exports = router;
