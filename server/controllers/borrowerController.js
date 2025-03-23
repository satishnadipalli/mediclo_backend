const Borrower = require("../models/Borrower");
const ToyBorrowing = require("../models/ToyBorrowing");
const { body, validationResult } = require("express-validator");

// Validation middleware
exports.borrowerValidation = [
  body("name").notEmpty().withMessage("Name is required").trim(),
  body("phone").notEmpty().withMessage("Phone number is required").trim(),
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .trim(),
  body("relationship")
    .notEmpty()
    .withMessage("Relationship to child is required")
    .isIn(["Father", "Mother", "Guardian", "Other"])
    .withMessage("Invalid relationship"),
  body("address").optional().trim(),
  body("notes").optional().trim(),
];

// @desc    Get all borrowers
// @route   GET /api/borrowers
// @access  Private
exports.getBorrowers = async (req, res) => {
  try {
    const query = {};

    // Add search by name, email or phone
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
        { phone: { $regex: req.query.search, $options: "i" } },
      ];
    }

    // Filter by relationship
    if (req.query.relationship) {
      query.relationship = req.query.relationship;
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    const borrowers = await Borrower.find(query)
      .sort({ name: 1 })
      .skip(startIndex)
      .limit(limit);

    const total = await Borrower.countDocuments(query);

    // Get active borrowings for each borrower
    const borrowersWithStatus = await Promise.all(
      borrowers.map(async (borrower) => {
        const activeBorrowings = await ToyBorrowing.find({
          email: borrower.email,
          returnDate: { $exists: false },
        }).countDocuments();

        const overdueBorrowings = await ToyBorrowing.find({
          email: borrower.email,
          returnDate: { $exists: false },
          dueDate: { $lt: new Date() },
        }).countDocuments();

        return {
          ...borrower._doc,
          activeBorrowings,
          overdueBorrowings,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: borrowersWithStatus,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Get borrower by ID
// @route   GET /api/borrowers/:id
// @access  Private
exports.getBorrower = async (req, res) => {
  try {
    const borrower = await Borrower.findById(req.params.id);

    if (!borrower) {
      return res.status(404).json({
        success: false,
        error: "Borrower not found",
      });
    }

    // Get borrower's active and past borrowings
    const activeBorrowings = await ToyBorrowing.find({
      email: borrower.email,
      returnDate: { $exists: false },
    })
      .sort({ dueDate: 1 })
      .populate({
        path: "toyId",
        select: "name category",
      })
      .populate({
        path: "toyUnitId",
        select: "unitNumber",
      });

    const pastBorrowings = await ToyBorrowing.find({
      email: borrower.email,
      returnDate: { $exists: true },
    })
      .sort({ returnDate: -1 })
      .limit(5)
      .populate({
        path: "toyId",
        select: "name category",
      })
      .populate({
        path: "toyUnitId",
        select: "unitNumber",
      });

    res.status(200).json({
      success: true,
      data: {
        borrower,
        activeBorrowings,
        pastBorrowings,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Create borrower
// @route   POST /api/borrowers
// @access  Private
exports.createBorrower = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Check if borrower with email already exists
    const existingBorrower = await Borrower.findOne({ email: req.body.email });
    if (existingBorrower) {
      return res.status(400).json({
        success: false,
        error: "Borrower with this email already exists",
      });
    }

    // Create borrower
    const borrower = new Borrower({
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      relationship: req.body.relationship,
      address: req.body.address,
      notes: req.body.notes,
      createdBy: req.user._id,
    });

    await borrower.save();

    res.status(201).json({
      success: true,
      data: borrower,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Update borrower
// @route   PUT /api/borrowers/:id
// @access  Private
exports.updateBorrower = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Find borrower
    let borrower = await Borrower.findById(req.params.id);
    if (!borrower) {
      return res.status(404).json({
        success: false,
        error: "Borrower not found",
      });
    }

    // Check if updating email and if it's already in use
    if (req.body.email !== borrower.email) {
      const existingBorrower = await Borrower.findOne({
        email: req.body.email,
      });
      if (existingBorrower) {
        return res.status(400).json({
          success: false,
          error: "Borrower with this email already exists",
        });
      }
    }

    // Update borrower
    borrower.name = req.body.name;
    borrower.phone = req.body.phone;
    borrower.email = req.body.email;
    borrower.relationship = req.body.relationship;
    borrower.address = req.body.address || borrower.address;
    borrower.notes = req.body.notes || borrower.notes;

    await borrower.save();

    res.status(200).json({
      success: true,
      data: borrower,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Delete borrower
// @route   DELETE /api/borrowers/:id
// @access  Private
exports.deleteBorrower = async (req, res) => {
  try {
    // Find borrower
    const borrower = await Borrower.findById(req.params.id);
    if (!borrower) {
      return res.status(404).json({
        success: false,
        error: "Borrower not found",
      });
    }

    // Check if borrower has active borrowings
    const activeBorrowings = await ToyBorrowing.find({
      email: borrower.email,
      returnDate: { $exists: false },
    });

    if (activeBorrowings.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete borrower with active borrowings",
      });
    }

    await borrower.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Get borrower stats (count by relationship, active borrowings, etc.)
// @route   GET /api/borrowers/stats
// @access  Private
exports.getBorrowerStats = async (req, res) => {
  try {
    // Get total borrowers
    const totalBorrowers = await Borrower.countDocuments();

    // Get borrowers by relationship
    const borrowersByRelationship = await Borrower.aggregate([
      {
        $group: {
          _id: "$relationship",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Get total active borrowings
    const activeBorrowings = await ToyBorrowing.countDocuments({
      returnDate: { $exists: false },
    });

    // Get total overdue borrowings
    const overdueBorrowings = await ToyBorrowing.countDocuments({
      returnDate: { $exists: false },
      dueDate: { $lt: new Date() },
    });

    res.status(200).json({
      success: true,
      data: {
        totalBorrowers,
        borrowersByRelationship,
        activeBorrowings,
        overdueBorrowings,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};
