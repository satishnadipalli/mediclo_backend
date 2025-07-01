const ToyBorrowing = require("../models/ToyBorrowing");
const ToyUnit = require("../models/ToyUnit");
const Toy = require("../models/Toy");
const Borrower = require("../models/Borrower");
const { body, validationResult } = require("express-validator");

// Validation middleware
exports.borrowToyValidation = [
  body("toyId").notEmpty().withMessage("Toy ID is required"),
  body("toyUnitId").notEmpty().withMessage("Toy unit ID is required"),
  body("borrowerName")
    .notEmpty()
    .withMessage("Borrower name is required")
    .trim(),
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
  body("issueDate")
    .notEmpty()
    .withMessage("Issue date is required")
    .isISO8601()
    .withMessage("Invalid date format"),
  body("dueDate")
    .notEmpty()
    .withMessage("Due date is required")
    .isISO8601()
    .withMessage("Invalid date format"),
  body("notes").optional().trim(),
];

exports.returnToyValidation = [
  body("conditionOnReturn")
    .notEmpty()
    .withMessage("Condition on return is required")
    .isIn(["Excellent", "Good", "Fair", "Needs Repair", "Damaged"])
    .withMessage("Invalid condition"),
  body("notes").optional().trim(),
];

// @desc    Get active borrowings
// @route   GET /api/toys/borrowings
// @access  Private
exports.getActiveBorrowings = async (req, res) => {
  console.log("HI")
  try {
    const query = { returnDate: { $exists: false } };

    console.log("Hello")
    // Add search by borrower name or email
    if (req.query.search) {
      query.$or = [
        { borrowerName: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ];
    }

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Get active borrowings
    const borrowings = await ToyBorrowing.find(query)
      .sort({ dueDate: 1 })
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
      count: borrowings.length,
      data: borrowings,
    });
  } catch (err) {
    console.log(err)
    res.status(500).json({
      success: false,
      error: "Server from Error",
    });
  }
};

// @desc    Get borrowing by ID
// @route   GET /api/toys/borrowings/:id
// @access  Private
exports.getBorrowing = async (req, res) => {
  try {
    console.log("Getting borrowing for ID:", req.params.id)
    const borrowing = await ToyBorrowing.findById(req.params.id)
      .populate({
        path: "toyId",
        select: "name category",
      })
      .populate({
        path: "toyUnitId",
        select: "unitNumber condition",
      })
      .populate({
        path: "issuedBy",
        select: "firstName lastName",
      })
      .populate({
        path: "returnProcessedBy",
        select: "firstName lastName",
      })

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        error: "Borrowing record not found",
      })
    }

    res.status(200).json({
      success: true,
      data: borrowing,
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    })
  }
}

// @desc    Issue a toy (create borrowing)
// @route   POST /api/toys/borrowings
// @access  Private
exports.issueToy = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Check if toy exists
    const toy = await Toy.findById(req.body.toyId);
    if (!toy) {
      return res.status(404).json({
        success: false,
        error: "Toy not found",
      });
    }

    // Check if toy unit exists and is available
    const toyUnit = await ToyUnit.findById(req.body.toyUnitId);
    if (!toyUnit) {
      return res.status(404).json({
        success: false,
        error: "Toy unit not found",
      });
    }

    if (!toyUnit.isAvailable) {
      return res.status(400).json({
        success: false,
        error: "This toy unit is already borrowed",
      });
    }

    // Create borrowing record
    const borrowing = new ToyBorrowing({
      toyId: req.body.toyId,
      toyUnitId: req.body.toyUnitId,
      borrowerName: req.body.borrowerName,
      phone: req.body.phone,
      email: req.body.email,
      relationship: req.body.relationship,
      issueDate: req.body.issueDate,
      dueDate: req.body.dueDate,
      status: "Borrowed",
      conditionOnIssue: toyUnit.condition,
      notes: req.body.notes,
      issuedBy: req.user._id,
    });

    await borrowing.save();

    // Create or update borrower record
    let borrower = await Borrower.findOne({ email: req.body.email });
    if (!borrower) {
      borrower = new Borrower({
        name: req.body.borrowerName,
        phone: req.body.phone,
        email: req.body.email,
        relationship: req.body.relationship,
        createdBy: req.user._id,
      });
      await borrower.save();
    }

    res.status(201).json({
      success: true,
      data: borrowing,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Return a toy
// @route   PUT /api/toys/borrowings/:id/return
// @access  Private
exports.returnToy = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    console.log("req params id: ", req.params.id); //debug
    // Get the borrowing record
    const borrowing = await ToyBorrowing.findById(req.params.id);
    if (!borrowing) {
      return res.status(404).json({
        success: false,
        error: "Borrowing record not found",
      });
    }

    // Check if already returned
    if (borrowing.returnDate) {
      return res.status(400).json({
        success: false,
        error: "This toy has already been returned",
      });
    }

    // Update borrowing record
    borrowing.returnDate = req.body.returnDate
      ? new Date(req.body.returnDate)
      : new Date();
    borrowing.status = "Returned";
    borrowing.conditionOnReturn = req.body.conditionOnReturn;
    borrowing.notes = req.body.notes
      ? `${borrowing.notes ? borrowing.notes + ". " : ""}Return notes: ${
          req.body.notes
        }`
      : borrowing.notes;
    borrowing.returnProcessedBy = req.user._id;

    await borrowing.save();

    res.status(200).json({
      success: true,
      data: borrowing,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Update borrowing status (mark as lost or damaged)
// @route   PUT /api/toys/borrowings/:id/status
// @access  Private
exports.updateBorrowingStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    // Validate status
    if (
      !status ||
      !["Borrowed", "Returned", "Overdue", "Lost", "Damaged"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid status",
      });
    }

    // Get the borrowing record
    const borrowing = await ToyBorrowing.findById(req.params.id);
    if (!borrowing) {
      return res.status(404).json({
        success: false,
        error: "Borrowing record not found",
      });
    }

    // Update borrowing record
    borrowing.status = status;

    // Add notes if provided
    if (notes) {
      borrowing.notes = `${
        borrowing.notes ? borrowing.notes + ". " : ""
      }Status update: ${notes}`;
    }

    // If marking as returned but no return date
    if (status === "Returned" && !borrowing.returnDate) {
      borrowing.returnDate = new Date();
      borrowing.returnProcessedBy = req.user._id;
    }

    await borrowing.save();

    res.status(200).json({
      success: true,
      data: borrowing,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Get borrower history
// @route   GET /api/toys/borrowers/:email/history
// @access  Private
exports.getBorrowerHistory = async (req, res) => {
  try {
    const { email } = req.params;

    // Find all borrowings for this borrower
    const borrowings = await ToyBorrowing.find({ email })
      .sort({ issueDate: -1 })
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
      count: borrowings.length,
      data: borrowings,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Search for available toy units
// @route   GET /api/toys/:id/available-units
// @access  Private
exports.getAvailableToyUnits = async (req, res) => {
  try {
    const { toyId } = req.params

    const availableUnits = await ToyUnit.find({
      toyId: toyId,
      isAvailable: true,
    }).select("unitNumber condition")

    res.json({
      success: true,
      data: availableUnits,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
};

// @desc    Get overdue borrowings
// @route   GET /api/toys/borrowings/overdue
// @access  Private
exports.getOverdueBorrowings = async (req, res) => {
  try {
    const today = new Date();

    const overdueBorrowings = await ToyBorrowing.find({
      returnDate: { $exists: false },
      dueDate: { $lt: today },
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

    res.status(200).json({
      success: true,
      count: overdueBorrowings.length,
      data: overdueBorrowings,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Manually trigger overdue update
// @route   PUT /api/toys/borrowings/overdue/update
// @access  Private (Admin or Staff)
exports.manualOverdueUpdate = async (req, res) => {
  try {
    const result = await ToyBorrowing.updateMany(
      {
        returnDate: { $exists: false },
        dueDate: { $lt: new Date() },
        status: "Borrowed",
      },
      { status: "Overdue" }
    );

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} borrowings to Overdue`,
    });
  } catch (err) {
    console.error("Manual overdue update error:", err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};
