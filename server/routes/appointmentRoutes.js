const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
  // Core appointment functions
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
  getAppointmentsCalendarView,

  // User requests
  submitAppointmentRequest,
  getPendingAppointmentRequests,
  convertRequestToAppointment,

  // Validation exports
  validateAppointment,
  validateUpdateAppointment,
  validateAppointmentRequest,
  validateFormalAppointment,
} = require("../controllers/appointmentController");

// ======================
// USER ROUTES
// ======================

// User submits appointment request (must be logged in as user/parent)
router.post(
  "/request",
  protect,
  authorize("user", "parent"),
  validateAppointmentRequest,
  validateRequest,
  submitAppointmentRequest
);

// ======================
// RECEPTIONIST / ADMIN ROUTES
// ======================

// Fetch pending appointment requests
router.get(
  "/requests/pending",
  protect,
  authorize("admin", "receptionist"),
  getPendingAppointmentRequests
);

// Convert appointment request to formal appointment
router.post(
  "/convert/:formId",
  protect,
  authorize("admin", "receptionist"),
  validateFormalAppointment,
  validateRequest,
  convertRequestToAppointment
);

// ======================
// APPOINTMENT CRUD
// ======================

// Get all appointments
router.get(
  "/",
  protect,
  authorize("admin", "receptionist", "therapist"),
  getAppointments
);

// Create formal appointment (receptionist / admin)
router.post(
  "/",
  protect,
  authorize("admin", "receptionist"),
  validateAppointment,
  validateRequest,
  createAppointment
);

// Get today's calendar view
router.get(
  "/calendar",
  protect,
  authorize("admin", "receptionist", "therapist"),
  getAppointmentsCalendarView
);

// Get, update, delete single appointment
router
  .route("/:id")
  .get(protect, authorize("admin", "receptionist", "therapist"), getAppointment)
  .put(
    protect,
    authorize("admin", "receptionist", "therapist"),
    validateUpdateAppointment,
    validateRequest,
    updateAppointment
  )
  .delete(protect, authorize("admin", "receptionist"), deleteAppointment);

// Reschedule appointment
router.put(
  "/:id/reschedule",
  protect,
  authorize("admin", "receptionist", "therapist"),
  rescheduleAppointment
);

// Update appointment status
router.put(
  "/:id/status",
  protect,
  authorize("admin", "receptionist", "therapist"),
  updateAppointmentStatus
);

module.exports = router;
