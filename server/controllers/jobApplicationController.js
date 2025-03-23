const JobApplication = require("../models/JobApplication");
const Job = require("../models/Job");
const { check, validationResult } = require("express-validator");
const { cloudinary } = require("../config/cloudinary");

// Validation rules
exports.createApplicationValidation = [
  check("resumeUrl", "Resume URL is required").notEmpty().isURL(),
];


exports.updateApplicationStatusValidation = [
  check("status", "Status must be valid").isIn([
    "pending",
    "reviewed",
    "interviewed",
    "rejected",
    "hired",
  ]),
  check("notes", "Notes are required when changing status")
    .optional()
    .notEmpty(),
  check("interviewDate", "Interview date must be a valid date")
    .optional()
    .isISO8601(),
];

// @desc    Get all applications (admin only)
// @route   GET /api/applications
// @access  Private/Admin
exports.getApplications = async (req, res, next) => {
  try {
    // Add filtering and pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    let query = {};

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by job
    if (req.query.jobId) {
      query.jobId = req.query.jobId;
    }

    // Get total count for pagination
    const total = await JobApplication.countDocuments(query);

    // Execute query with pagination
    const applications = await JobApplication.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate({
        path: "jobId",
        select: "title department type",
      });

    // Pagination result
    const pagination = {
      total,
      pages: Math.ceil(total / limit),
      page,
      limit,
    };

    res.status(200).json({
      success: true,
      count: applications.length,
      pagination,
      data: applications,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get applications for a specific job (admin only)
// @route   GET /api/jobs/:jobId/applications
// @access  Private/Admin
exports.getJobApplications = async (req, res, next) => {
  try {
    const applications = await JobApplication.find({
      jobId: req.params.jobId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user's applications
// @route   GET /api/applications/me
// @access  Private
exports.getUserApplications = async (req, res, next) => {
  try {
    const applications = await JobApplication.find({
      "applicant.userId": req.user.id,
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "jobId",
        select: "title department type location",
      });

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single application
// @route   GET /api/applications/:id
// @access  Private
exports.getApplication = async (req, res, next) => {
  try {
    const application = await JobApplication.findById(req.params.id).populate({
      path: "jobId",
      select: "title department type location",
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: "Application not found",
      });
    }

    // Check if user has permission to view this application
    if (
      req.user.role !== "admin" &&
      application.applicant.userId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access this application",
      });
    }

    res.status(200).json({
      success: true,
      data: application,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new application
// @route   POST /api/jobs/:jobId/apply
// @access  Private
exports.createApplication = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Check if job exists and is active
    const job = await Job.findById(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    if (!job.isActive) {
      return res.status(400).json({
        success: false,
        error: "This job is no longer accepting applications",
      });
    }

    // Check if deadline has passed
    if (new Date(job.applicationDeadline) < new Date()) {
      return res.status(400).json({
        success: false,
        error: "Application deadline has passed",
      });
    }

    // Check if user has already applied
    const existingApplication = await JobApplication.findOne({
      jobId: req.params.jobId,
      "applicant.userId": req.user.id,
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        error: "You have already applied for this job",
      });
    }

    // Check if resumeUrl was provided
    if (!req.body.resumeUrl) {
      return res.status(400).json({
        success: false,
        error: "Resume URL is required",
      });
    }

    // Create application object
    const applicationData = {
      jobId: req.params.jobId,
      applicant: {
        userId: req.user.id,
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        phone: req.body.applicant.phone,
      },
      resume: req.body.resumeUrl,
      coverLetter: req.body.coverLetter,
    };
    const application = await JobApplication.create(applicationData);

    // Increment application count on the job
    await Job.findByIdAndUpdate(req.params.jobId, {
      $inc: { applicationCount: 1 },
    });

    res.status(201).json({
      success: true,
      data: application,
    });
  } catch (err) {
    console.error("Error in createApplication:", err);
    next(err);
  }
};

// @desc    Update application status (admin only)
// @route   PUT /api/applications/:id/status
// @access  Private/Admin
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const application = await JobApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: "Application not found",
      });
    }

    // Update fields
    application.status = req.body.status;

    if (req.body.notes) {
      application.notes = req.body.notes;
    }

    if (req.body.interviewDate) {
      application.interviewDate = req.body.interviewDate;
    }

    await application.save();

    res.status(200).json({
      success: true,
      data: application,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete application
// @route   DELETE /api/applications/:id
// @access  Private/Admin
exports.deleteApplication = async (req, res, next) => {
  try {
    const application = await JobApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: "Application not found",
      });
    }

    // Check if user has permission to delete this application
    if (
      req.user.role !== "admin" &&
      application.applicant.userId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to delete this application",
      });
    }

    // Delete resume from Cloudinary
    if (application.resume) {
      try {
        // Extract public_id from the URL
        const urlParts = application.resume.split("/");
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split(".")[0];

        if (publicId) {
          await cloudinary.uploader.destroy(`8senses/resumes/${publicId}`);
        }
      } catch (error) {
        console.error("Error deleting resume from Cloudinary:", error);
      }
    }

    await application.deleteOne();

    // Decrement application count on the job
    await Job.findByIdAndUpdate(application.jobId, {
      $inc: { applicationCount: -1 },
    });

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};
