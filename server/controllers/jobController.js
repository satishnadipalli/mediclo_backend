const Job = require("../models/Job");
const { check, validationResult } = require("express-validator");

// Validation rules
exports.createJobValidation = [
  check("title", "Job title is required").notEmpty(),
  check("department", "Department must be valid").isIn([
    "Therapy",
    "Administration",
    "Management",
    "Education",
    "Other",
  ]),
  check("type", "Job type must be valid").isIn([
    "Full-time",
    "Part-time",
    "Contract",
    "Internship",
  ]),
  check("location", "Location is required").notEmpty(),
  check("description", "Description is required").notEmpty(),
  check("requirements", "Requirements must be an array").isArray(),
  check("responsibilities", "Responsibilities must be an array").isArray(),
  check("qualifications", "Qualifications must be an array").isArray(),
  check(
    "applicationDeadline",
    "Application deadline must be a valid date"
  ).isISO8601(),
];

exports.updateJobValidation = [
  check("title", "Job title is required").optional().notEmpty(),
  check("department", "Department must be valid")
    .optional()
    .isIn(["Therapy", "Administration", "Management", "Education", "Other"]),
  check("type", "Job type must be valid")
    .optional()
    .isIn(["Full-time", "Part-time", "Contract", "Internship"]),
  check("location", "Location is required").optional().notEmpty(),
  check("description", "Description is required").optional().notEmpty(),
  check("requirements", "Requirements must be an array").optional().isArray(),
  check("responsibilities", "Responsibilities must be an array")
    .optional()
    .isArray(),
  check("qualifications", "Qualifications must be an array")
    .optional()
    .isArray(),
  check("applicationDeadline", "Application deadline must be a valid date")
    .optional()
    .isISO8601(),
  check("isActive", "isActive must be a boolean").optional().isBoolean(),
];

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Public
exports.getJobs = async (req, res, next) => {
  try {
    // Add filtering and pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    let query = {};

    // Filter by active status (default to active jobs for public)
    if (req.query.isActive) {
      query.isActive = req.query.isActive === "true";
    } else if (!req.user || req.user.role !== "admin") {
      query.isActive = true;
    }

    // Filter by department
    if (req.query.department) {
      query.department = req.query.department;
    }

    // Filter by job type
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Filter by search term
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // Get total count for pagination
    const total = await Job.countDocuments(query);

    // Execute query with pagination
    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate({
        path: "postedBy",
        select: "firstName lastName",
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
      count: jobs.length,
      pagination,
      data: jobs,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single job
// @route   GET /api/jobs/:id
// @access  Public
exports.getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).populate({
      path: "postedBy",
      select: "firstName lastName",
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new job
// @route   POST /api/jobs
// @access  Private/Admin
exports.createJob = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Set posted by to current user
    req.body.postedBy = req.user.id;

    const job = await Job.create(req.body);

    res.status(201).json({
      success: true,
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private/Admin
exports.updateJob = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    job = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private/Admin
exports.deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    await job.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get jobs by department
// @route   GET /api/jobs/department/:department
// @access  Public
exports.getJobsByDepartment = async (req, res, next) => {
  try {
    const validDepartments = [
      "Therapy",
      "Administration",
      "Management",
      "Education",
      "Other",
    ];

    if (!validDepartments.includes(req.params.department)) {
      return res.status(400).json({
        success: false,
        error: "Invalid department specified",
      });
    }

    const jobs = await Job.find({
      department: req.params.department,
      isActive: true,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
    });
  } catch (err) {
    next(err);
  }
};
