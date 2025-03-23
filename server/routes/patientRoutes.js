const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
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
  updatePatientPhoto,
  updateBirthCertificate,
  updateParentPhoto,
  addMedicalRecord,
  updateAadharCard,
} = require("../controllers/patientController");
const { validateRequest } = require("../middleware/validationMiddleware");
const Patient = require("../models/Patient");

const router = express.Router();

// GET /api/patients - Get all patients (filtered by user role)
router.route("/").get(protect, getPatients);

// POST /api/patients - Create a new patient (only admin, therapist, receptionist)
router
  .route("/register")
  .post(
    protect,
    authorize("admin", "therapist", "receptionist"),
    createPatientValidation,
    validateRequest,
    createPatient
  );

// GET /api/patients/:id - Get single patient
// PUT /api/patients/:id - Update patient
// DELETE /api/patients/:id - Delete patient (admin, therapist, receptionist only)
router
  .route("/:id")
  .get(protect, getPatient)
  .put(protect, updatePatientValidation, validateRequest, updatePatient)
  .delete(protect, deletePatient);

// POST /api/patients/:id/notes - Add a note to patient (admin and therapist only)
router
  .route("/:id/notes")
  .post(
    protect,
    authorize("admin", "therapist"),
    addNoteValidation,
    validateRequest,
    addPatientNote
  )
  .get(protect, async (req, res, next) => {
    try {
      const patient = await Patient.findById(req.params.id);

      if (!patient) {
        return res.status(404).json({
          success: false,
          error: "Patient not found",
        });
      }

      // Check permissions
      if (
        req.user.role === "parent" &&
        patient.parentId.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to access this patient",
        });
      }

      res.status(200).json({
        success: true,
        data: patient.therapistNotes,
      });
    } catch (err) {
      next(err);
    }
  });

// POST /api/patients/:id/assessments - Add an assessment to patient (admin and therapist only)
router
  .route("/:id/assessments")
  .post(
    protect,
    authorize("admin", "therapist"),
    addAssessmentValidation,
    validateRequest,
    addPatientAssessment
  )
  .get(protect, async (req, res, next) => {
    try {
      const patient = await Patient.findById(req.params.id);

      if (!patient) {
        return res.status(404).json({
          success: false,
          error: "Patient not found",
        });
      }

      // Check permissions
      if (
        req.user.role === "parent" &&
        patient.parentId.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to access this patient",
        });
      }

      res.status(200).json({
        success: true,
        data: patient.assessments,
      });
    } catch (err) {
      next(err);
    }
  });

// GET /api/patients/parent/:parentId - Get all patients for a specific parent
router
  .route("/parent/:parentId")
  .get(
    protect,
    authorize("admin", "therapist", "receptionist"),
    async (req, res, next) => {
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
    }
  );

// Document upload routes
router.route("/:id/photo").put(protect, updatePatientPhoto);

router.route("/:id/birth-certificate").put(protect, updateBirthCertificate);

router.route("/:id/aadhar-card").put(protect, updateAadharCard);

router.route("/:id/parent-photo").put(protect, updateParentPhoto);

router.route("/:id/medical-records").post(protect, addMedicalRecord);

module.exports = router;
