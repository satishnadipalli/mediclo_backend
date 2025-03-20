const express = require("express");
const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");
const {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  addPatientNote,
  addPatientAssessment,
  createPatientValidation,
  updatePatientValidation,
  addNoteValidation,
  addAssessmentValidation,
} = require("../controllers/patientController");

const router = express.Router();

// Apply protection to all routes
router.use(protect);

// GET /api/patients - Get all patients (filtered by user role)
// POST /api/patients - Create a new patient
router.route("/").get(getPatients).post(createPatientValidation, createPatient);

// GET /api/patients/:id - Get single patient
// PUT /api/patients/:id - Update patient
// DELETE /api/patients/:id - Delete patient (admin and therapist only)
router
  .route("/:id")
  .get(getPatient)
  .put(updatePatientValidation, updatePatient)
  .delete(authorize("admin", "therapist"), deletePatient);

// POST /api/patients/:id/notes - Add a note to patient (admin and therapist only)
router
  .route("/:id/notes")
  .post(authorize("admin", "therapist"), addNoteValidation, addPatientNote);

// POST /api/patients/:id/assessments - Add an assessment to patient (admin and therapist only)
router
  .route("/:id/assessments")
  .post(
    authorize("admin", "therapist"),
    addAssessmentValidation,
    addPatientAssessment
  );

// GET /api/patients/:id/notes - Get all notes for a patient
router.route("/:id/notes").get(getPatient, (req, res) => {
  res.status(200).json({
    success: true,
    data: req.patient.therapistNotes,
  });
});

// GET /api/patients/:id/assessments - Get all assessments for a patient
router.route("/:id/assessments").get(getPatient, (req, res) => {
  res.status(200).json({
    success: true,
    data: req.patient.assessments,
  });
});

// GET /api/patients/parent/:parentId - Get all patients for a specific parent
router
  .route("/parent/:parentId")
  .get(authorize("admin", "therapist"), async (req, res, next) => {
    try {
      const patients = await Patient.find({ parentId: req.params.parentId });

      res.status(200).json({
        success: true,
        count: patients.length,
        data: patients,
      });
    } catch (err) {
      next(err);
    }
  });

module.exports = router;
