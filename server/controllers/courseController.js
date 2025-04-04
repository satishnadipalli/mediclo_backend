const Course = require("../models/Course");
const ErrorResponse = require("../utils/errorResponse");
const { body, param, validationResult } = require("express-validator");
const CourseEnrollment = require("../models/CourseEnrollment");

// Validation middleware
exports.validateCourse = [
  body("title")
    .notEmpty()
    .withMessage("Please add a course title")
    .isLength({ max: 100 })
    .withMessage("Course title cannot be more than 100 characters"),
  body("instructor").optional(),
  body("price")
    .notEmpty()
    .withMessage("Please add a price")
    .isNumeric()
    .withMessage("Price must be a number")
    .custom((value) => value >= 0)
    .withMessage("Price must be at least 0"),
  body("description").notEmpty().withMessage("Please add a course description"),
  body("thumbnail").notEmpty().withMessage("Please upload a course thumbnail"),
  body("category").notEmpty().withMessage("Please select a course category"),
  body("status")
    .optional()
    .isIn(["draft", "published", "archived", "active"])
    .withMessage("Invalid status value"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  },
];

exports.validateCourseVideo = [
  body("url").notEmpty().withMessage("Please add a video URL"),
  body("title").notEmpty().withMessage("Please add a video title"),
  body("duration")
    .optional()
    .isNumeric()
    .withMessage("Duration must be a number"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  },
];

exports.validateCourseStatus = [
  body("status")
    .notEmpty()
    .withMessage("Please provide a status")
    .isIn(["draft", "published", "archived"])
    .withMessage("Invalid status value"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  },
];

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
exports.getCourses = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit"];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Finding resource
    let query = Course.find(JSON.parse(queryStr));

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Course.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const courses = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.status(200).json({
      success: true,
      count: courses.length,
      pagination,
      data: courses,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Public
exports.getCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return next(
        new ErrorResponse(`Course not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new course
// @route   POST /api/courses
// @access  Private/Admin
exports.createCourse = async (req, res, next) => {
  try {
    const course = await Course.create(req.body);

    res.status(201).json({
      success: true,
      data: course,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private/Admin
exports.updateCourse = async (req, res, next) => {
  try {
    let course = await Course.findById(req.params.id);

    if (!course) {
      return next(
        new ErrorResponse(`Course not found with id of ${req.params.id}`, 404)
      );
    }

    course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private/Admin
exports.deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return next(
        new ErrorResponse(`Course not found with id of ${req.params.id}`, 404)
      );
    }

    await course.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add video to course
// @route   POST /api/courses/:id/videos
// @access  Private/Admin
exports.addCourseVideo = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return next(
        new ErrorResponse(`Course not found with id of ${req.params.id}`, 404)
      );
    }

    // Add video to videos array
    course.videos.push(req.body);
    await course.save();

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete video from course
// @route   DELETE /api/courses/:id/videos/:videoId
// @access  Private/Admin
exports.deleteCourseVideo = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return next(
        new ErrorResponse(`Course not found with id of ${req.params.id}`, 404)
      );
    }

    // Get video index
    const videoIndex = course.videos.findIndex(
      (video) => video._id.toString() === req.params.videoId
    );

    if (videoIndex === -1) {
      return next(
        new ErrorResponse(
          `Video not found with id of ${req.params.videoId}`,
          404
        )
      );
    }

    // Remove video from array
    course.videos.splice(videoIndex, 1);
    await course.save();

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update course status
// @route   PUT /api/courses/:id/status
// @access  Private/Admin
exports.updateCourseStatus = async (req, res, next) => {
  try {
    let course = await Course.findById(req.params.id);

    if (!course) {
      return next(
        new ErrorResponse(`Course not found with id of ${req.params.id}`, 404)
      );
    }

    course.status = req.body.status;
    await course.save();

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Enroll in a course without authentication
// @route   POST /api/courses/public/enroll/:id
// @access  Public
exports.enrollPublicInCourse = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, paymentMethod } = req.body;

    const courseId = req.params.id;

    // Check if course exists and is open for enrollment
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        error: "Course not found",
      });
    }

    if (course.status !== "active") {
      return res.status(400).json({
        success: false,
        error: "This course is not open for enrollment",
      });
    }

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        error: "Please provide all required fields",
      });
    }

    // Check if user is already enrolled
    const existingEnrollment = await CourseEnrollment.findOne({
      courseId,
      email,
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        error: "You are already enrolled in this course",
      });
    }

    // Create the enrollment
    const enrollment = await CourseEnrollment.create({
      courseId,
      firstName,
      lastName,
      email,
      phone: phone || "",
      paymentStatus: "pending",
      paymentMethod: paymentMethod || "card",
      status: "enrolled",
      isPublicSubmission: true,
      progress: 0,
      completedLessons: [],
    });

    // Increment enrollment count
    course.enrollmentsCount = (course.enrollmentsCount || 0) + 1;
    await course.save();

    // Send successful response
    res.status(201).json({
      success: true,
      message:
        "Thank you for enrolling! Course details will be sent to your email.",
      reference: enrollment._id,
    });
  } catch (err) {
    console.error("Error enrolling in course:", err);
    res.status(500).json({
      success: false,
      error:
        "We couldn't process your enrollment. Please try again or contact us directly.",
    });
  }
};
