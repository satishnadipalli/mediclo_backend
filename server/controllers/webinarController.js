const Webinar = require("../models/Webinar");
const WebinarRegistration = require("../models/WebinarRegistration");
const ErrorResponse = require("../utils/errorResponse");
const { body, param, validationResult } = require("express-validator");

// Validation middleware
exports.validateWebinar = [
  body("title")
    .notEmpty()
    .withMessage("Please add a webinar title")
    .isLength({ max: 100 })
    .withMessage("Webinar title cannot be more than 100 characters"),
  body("speaker").notEmpty().withMessage("Please add a speaker name"),
  body("date").notEmpty().withMessage("Please select a start date"),
  body("duration")
    .notEmpty()
    .withMessage("Please select webinar duration")
    .isNumeric()
    .withMessage("Duration must be a number"),
  body("startTime").notEmpty().withMessage("Please select a start time"),
  body("maxRegistrations")
    .notEmpty()
    .withMessage("Please select maximum registrations")
    .isInt({ min: 1 })
    .withMessage("Maximum registrations must be at least 1"),
  body("status")
    .optional()
    .isIn(["upcoming", "live", "completed", "cancelled"])
    .withMessage("Invalid status value"),
  body("url").notEmpty().withMessage("Please add a webinar URL"),
  body("thumbnail").notEmpty().withMessage("Please upload a webinar thumbnail"),
  body("description")
    .notEmpty()
    .withMessage("Please add a webinar description"),
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

exports.validateWebinarStatus = [
  body("status")
    .notEmpty()
    .withMessage("Please provide a status")
    .isIn(["upcoming", "live", "completed", "cancelled"])
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

// Validation for public webinar registration
exports.validatePublicRegistration = [
  body("name").notEmpty().withMessage("Name is required"),
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address"),
  body("phone").optional()
];

// @desc    Get all webinars
// @route   GET /api/webinars
// @access  Public
exports.getWebinars = async (req, res, next) => {
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
    let query = Webinar.find(JSON.parse(queryStr));

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
      query = query.sort("-date"); // Sort by date descending by default
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Webinar.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const webinars = await query;

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
      count: webinars.length,
      pagination,
      data: webinars,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get upcoming webinars
// @route   GET /api/webinars/upcoming
// @access  Public
exports.getUpcomingWebinars = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Finding upcoming webinars with available slots
    const webinars = await Webinar.find({
      date: { $gte: today },
      status: "upcoming",
    }).sort("date");

    res.status(200).json({
      success: true,
      count: webinars.length,
      data: webinars,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single webinar
// @route   GET /api/webinars/:id
// @access  Public
exports.getWebinar = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id);

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: webinar,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new webinar
// @route   POST /api/webinars
// @access  Private/Admin
exports.createWebinar = async (req, res, next) => {
  try {
    const webinar = await Webinar.create(req.body);

    res.status(201).json({
      success: true,
      data: webinar,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update webinar
// @route   PUT /api/webinars/:id
// @access  Private/Admin
exports.updateWebinar = async (req, res, next) => {
  try {
    let webinar = await Webinar.findById(req.params.id);

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    webinar = await Webinar.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: webinar,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete webinar
// @route   DELETE /api/webinars/:id
// @access  Private/Admin
exports.deleteWebinar = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id);

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    // Also delete registrations when deleting webinar
    await WebinarRegistration.deleteMany({ webinarId: req.params.id });

    await webinar.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update webinar status
// @route   PUT /api/webinars/:id/status
// @access  Private/Admin
exports.updateWebinarStatus = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id);

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    webinar.status = req.body.status;
    await webinar.save();

    res.status(200).json({
      success: true,
      data: webinar,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get webinar registrations
// @route   GET /api/webinars/:id/registrations
// @access  Private/Admin
exports.getWebinarRegistrations = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id);

    if (!webinar) {
      return next(
        new ErrorResponse(`Webinar not found with id of ${req.params.id}`, 404)
      );
    }

    const registrations = await WebinarRegistration.find({
      webinarId: req.params.id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: registrations.length,
      data: registrations,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Register for webinar (public)
// @route   POST /api/webinars/public/register/:id
// @access  Public
exports.registerPublicForWebinar = async (req, res) => {
  try {
    const { name, email, phone, occupation, organization } = req.body;
    const webinarId = req.params.id;

    // Check if webinar exists and is upcoming
    const webinar = await Webinar.findById(webinarId);
    if (!webinar) {
      return res.status(404).json({
        success: false,
        error: "Webinar not found",
      });
    }

    if (webinar.status !== "upcoming") {
      return res.status(400).json({
        success: false,
        error: "This webinar is no longer open for registration",
      });
    }

    // Check if webinar has reached maximum registrations
    if (webinar.participantsCount >= webinar.maxRegistrations) {
      return res.status(400).json({
        success: false,
        error: "This webinar has reached maximum capacity",
      });
    }

    // Check if the email is already registered
    const existingRegistration = await WebinarRegistration.findOne({
      webinarId,
      email,
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        error: "You have already registered for this webinar",
      });
    }

    // Create the registration
    const registration = await WebinarRegistration.create({
      webinarId,
      name,
      email,
      phone: phone || "",
      occupation: occupation || "",
      organization: organization || "",
      status: "registered",
    });

    // Increment participants count
    webinar.participantsCount = (webinar.participantsCount || 0) + 1;
    await webinar.save();

    // Send successful response
    res.status(201).json({
      success: true,
      message: "Thank you for registering! Details will be sent to your email.",
      reference: registration._id,
    });
  } catch (err) {
    console.error("Error registering for webinar:", err);
    res.status(500).json({
      success: false,
      error:
        "We couldn't process your registration. Please try again or contact us directly.",
    });
  }
};

// @desc    Mark registration as attended
// @route   PUT /api/webinars/:webinarId/registrations/:id/attend
// @access  Private/Admin
exports.markAttendance = async (req, res, next) => {
  try {
    const registration = await WebinarRegistration.findOne({
      _id: req.params.id,
      webinarId: req.params.webinarId,
    });

    if (!registration) {
      return next(new ErrorResponse(`Registration not found`, 404));
    }

    registration.attended = true;
    registration.status = "attended";
    await registration.save();

    res.status(200).json({
      success: true,
      data: registration,
    });
  } catch (err) {
    next(err);
  }
};


// @desc    Delete a webinar registration
// @route   DELETE /api/webinars/:webinarId/registrations/:id
// @access  Private/Admin
exports.deleteWebinarRegistration = async (req, res, next) => {
  try {
    const { webinarId, id } = req.params;

    // Find the registration
    const registration = await WebinarRegistration.findOne({
      _id: id,
      webinarId,
    });

    if (!registration) {
      return next(
        new ErrorResponse(`Registration not found for this webinar`, 404)
      );
    }

    // Decrement the webinar participant count
    await Webinar.findByIdAndUpdate(webinarId, {
      $inc: { participantsCount: -1 },
    });

    // Delete the registration
    await registration.deleteOne();

    res.status(200).json({
      success: true,
      message: "Registration removed successfully",
    });
  } catch (err) {
    next(err);
  }
};
