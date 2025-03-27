const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
  getTherapistAppointments,
  getPatientAppointments,
  validateAppointment,
  validateUpdateAppointment,
  validateParentAppointmentRequest,
  createParentAppointmentRequest,
  assignTherapistToAppointment,
} = require("../controllers/appointmentController");

// Get all appointments
router
  .route("/")
  .get(
     // protect,
    // authorize("admin", "therapist", "receptionist"),
    getAppointments
  )
  .post(
    // protect,
    // authorize("admin", "therapist", "receptionist"),
    validateAppointment,
    validateRequest,
    createAppointment
  );

// Get/update/delete specific appointment
router
  .route("/:id")
  .get(
    // protect,
     getAppointment)
  .put(
    // protect,
    // authorize("admin", "therapist", "receptionist"),
    validateUpdateAppointment,
    validateRequest,
    updateAppointment
  )
  .delete(
    // protect, authorize("admin", "receptionist"),
    deleteAppointment);

// Reschedule appointment
router.put(
  "/:id/reschedule",
  // protect,
  // authorize("admin", "therapist", "receptionist"),
  rescheduleAppointment
);

// Update appointment status
router.put(
  "/:id/status",
  // protect,
  // authorize("admin", "therapist", "receptionist"),
  updateAppointmentStatus
);

// Get therapist's appointments
router.get(
  "/therapist/:therapistId",
  // protect,
  // authorize("admin", "therapist", "receptionist"),
  getTherapistAppointments
);

// Get patient's appointments
router.get("/patient/:patientId", protect, getPatientAppointments);

// Parent appointment request (without requiring therapist selection)
router.post(
  "/request",
  // protect,
  // authorize("parent"),
  validateParentAppointmentRequest,
  validateRequest,
  createParentAppointmentRequest
);

// Assign therapist to pending appointment request
router.put(
  "/:id/assign-therapist",
  // protect,
  // authorize("admin", "receptionist"),
  assignTherapistToAppointment
);

module.exports = router;
