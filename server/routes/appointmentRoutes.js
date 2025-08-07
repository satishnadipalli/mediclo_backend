const express = require("express")
const router = express.Router()
const { protect, authorize } = require("../middleware/authMiddleware")
const { validateRequest } = require("../middleware/validationMiddleware")
const {
  // Existing functions
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
  getAppointmentsCalendarView,
  submitAppointmentRequest,
  getPendingAppointmentRequests,
  convertRequestToAppointment,
  validateAppointment,
  validateUpdateAppointment,
  validateAppointmentRequest,
  validateFormalAppointment,
  getAppointmentsByDate,
  updateAppointmentStatusAndDetails,
  createMultipleAppointments,
  updatePatientAppointmentsPayment,

  // New functions for patient payment management
  getPatientsWithAppointments,
  processAppointmentPayment,
  dashboardRescheduleAppointment,
  createGroupAppointment,
  getGroupAppointments,
  updateGroupAppointment,
  cancelGroupAppointment,
  getCalendarView,
  getDashboardByDate,
  updateGroupAppointmentEnhanced,
  rescheduleGroupAppointment,

} = require("../controllers/appointmentController")


// ======================
// USER ROUTES
// ======================
router.post("/request", protect, authorize("user", "parent"), submitAppointmentRequest)

// ======================
// RECEPTIONIST / ADMIN ROUTES
// ======================
router.get("/requests/pending", protect, authorize("admin", "receptionist"), getPendingAppointmentRequests)

router.post(
  "/convert/:formId",
  protect,
  authorize("admin", "receptionist"),
  validateFormalAppointment,
  validateRequest,
  convertRequestToAppointment,
)

// ======================
// PATIENT PAYMENT MANAGEMENT ROUTES (MUST COME BEFORE /:id ROUTES)
// ======================

// Get patients with appointments - MUST come before /:id route
router.get("/with-appointments", protect, authorize("admin", "receptionist"), getPatientsWithAppointments)

// Process payment for appointments - MUST come before /:id route
router.post("/process-payment", protect, authorize("admin", "receptionist"), processAppointmentPayment)

// ======================
// APPOINTMENT CRUD
// ======================
router.get("/", protect, authorize("admin", "receptionist", "therapist"), getAppointments)

// Single appointment creation
router.post("/", createAppointment)

// Multiple appointments creation
router.post("/multiple", protect, authorize("admin", "receptionist"), createMultipleAppointments)

// Bulk payment update for patient appointments
router.put("/patient/payment", protect, authorize("admin", "receptionist"), updatePatientAppointmentsPayment)

router.get("/calendar", protect, authorize("admin", "receptionist", "therapist"), getAppointmentsCalendarView)

router.get("/by-date", protect, authorize("admin", "receptionist", "therapist"), getAppointmentsByDate)


// ======================
// INDIVIDUAL APPOINTMENT ROUTES (MUST COME LAST)
// ======================
router
  .route("/:id")
  .get(protect, authorize("admin", "receptionist", "therapist"), getAppointment)
  .put(updateAppointment)
  .delete(protect, authorize("admin", "receptionist"), deleteAppointment)

router.put("/updateappointment/:id", updateAppointmentStatusAndDetails)

router.put("/:id/reschedule", protect, authorize("admin", "receptionist", "therapist"), rescheduleAppointment)

router.put("/:id/status", protect, authorize("admin", "receptionist", "therapist"), updateAppointmentStatus)
// Add this route to your appointments router
router.put('/:id/dashboard-reschedule', dashboardRescheduleAppointment);



// Group appointmetn routes
// Group appointment routes
router.post("/group", protect, authorize("admin", "receptionist"), createGroupAppointment)
router.get("/group", protect, authorize("admin", "receptionist", "therapist"), getGroupAppointments)
router.put("/group/:groupSessionId", protect, authorize("admin", "receptionist"), updateGroupAppointment)
router.delete("/group/:groupSessionId", protect, authorize("admin", "receptionist"), cancelGroupAppointment)

// Add these routes after your existing group routes
router.put("/group/:groupSessionId/update", protect, authorize("admin", "receptionist"), updateGroupAppointmentEnhanced)
router.put("/group/:groupSessionId/reschedule", protect, authorize("admin", "receptionist"), rescheduleGroupAppointment)

// Dashboard and calendar routes
// router.get("/calendar", protect, authorize("admin", "receptionist", "therapist"), getDashboardByDate)
// router.get("/calendar-view", protect, authorize("admin", "receptionist", "therapist"), getCalendarView)


module.exports = router








// router.post("/slot-availability", protect, authorize("admin", "receptionist"), checkSlotAvailability);
// router.post("/check-conflicts", protect, authorize("admin", "receptionist"), checkAppointmentConflicts);
// router.get("/available-slots/:doctorId/:date", protect, authorize("admin", "receptionist"), getAvailableSlots);



