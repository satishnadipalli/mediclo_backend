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
  // validateParentAppointmentRequest,
  // createParentAppointmentRequest,
  assignTherapistToAppointment,
  getPublicAppointmentRequests,
  convertPublicAppointmentRequest,
  submitPublicAppointment,
  validatePublicAppointment,
  checkPublicAppointmentStatus,
  saveAppointmentAsDraft,
  getAppointmentsCalendarView,
} = require("../controllers/appointmentController");

// Public routes - no authentication needed
router.post(
  "/public",
  validatePublicAppointment,
  validateRequest,
  submitPublicAppointment
);
router.get("/public/status/:id", checkPublicAppointmentStatus);

// Get all appointments and create appointments (Admin, Therapist, Receptionist)
router
  .route("/")
  .get(
    protect,
    authorize("admin", "therapist", "receptionist"),
    getAppointments
  )
  .post(
    protect,
    authorize("admin", "receptionist"),
    validateAppointment,
    validateRequest,
    createAppointment
  );

router.post(
  "/save-later",
  protect,
  authorize("admin", "receptionist"),
  saveAppointmentAsDraft
);

// Get today's calendar view (grouped by therapist and time)
router.get(
  "/calendar",
  protect,
  authorize("admin", "therapist", "receptionist"),
  getAppointmentsCalendarView
);

// Get/update/delete specific appointment
router
  .route("/:id")
  .get(protect, authorize("admin", "therapist", "receptionist"), getAppointment)
  .put(
    protect,
    authorize("admin", "therapist", "receptionist"),
    validateUpdateAppointment,
    validateRequest,
    updateAppointment
  )
  .delete(protect, authorize("admin", "receptionist"), deleteAppointment);

// Reschedule appointment
router.put(
  "/:id/reschedule",
  protect,
  authorize("admin", "therapist", "receptionist"),
  rescheduleAppointment
);

// Update appointment status
router.put(
  "/:id/status",
  protect,
  authorize("admin", "therapist", "receptionist"),
  updateAppointmentStatus
);

// Get therapist's appointments
router.get(
  "/therapist/:therapistId",
  protect,
  authorize("admin", "therapist", "receptionist"),
  getTherapistAppointments
);

// Get patient's appointments
router.get(
  "/patient/:patientId",
  protect,
  authorize("admin", "therapist", "receptionist"),
  getPatientAppointments
);

// Parent appointment request (without requiring therapist selection)
// router.post(
//   "/request",
//   protect,
//   authorize("parent"),
//   validateParentAppointmentRequest,
//   validateRequest,
//   createParentAppointmentRequest
// );

// Assign therapist to pending appointment request
router.put(
  "/:id/assign-therapist",
  protect,
  authorize("admin", "receptionist"),
  assignTherapistToAppointment
);

// Get all public appointment requests
router.get(
  "/public-requests",
  protect,
  authorize("admin", "receptionist"),
  getPublicAppointmentRequests
);

// Convert public appointment request to formal appointment
router.put(
  "/:id/convert-public-request",
  protect,
  authorize("admin", "receptionist"),
  convertPublicAppointmentRequest
);

module.exports = router;
