const Borrower = require("../models/Borrower");
const ToyBorrowing = require("../models/ToyBorrowing");
const { body, validationResult } = require("express-validator");
const Toy = require("../models/Toy");

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

    // console.log("hi-----------------------------------------")

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

    await borrower.deleteOne();

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



// Toy borrwoer controllers

// Additional APIs needed for Process Return functionality
// Add these to your existing server.js or create separate route files

// const { body, validationResult } = require("express-validator")

// ============================================
// PROCESS RETURN ROUTES
// Add these routes to your server.js or create a new processReturnRoutes.js file
// ============================================

// @desc    Smart search for borrowers or toys
// @route   GET /api/process-return/smart-search
// @access  Private
exports.smartSearch = async (req, res) => {
  try {
    const { search } = req.query

    if (!search || search.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Search term must be at least 2 characters",
      })
    }

    // Search in active borrowings first
    const borrowings = await ToyBorrowing.find({
      returnDate: { $exists: false },
      $or: [
        { borrowerName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    })
      .populate({
        path: "toyId",
        select: "name category image",
      })
      .populate({
        path: "toyUnitId",
        select: "unitNumber condition",
      })
      .sort({ dueDate: 1 })

    if (borrowings.length > 0) {
      // Group by borrower email
      const borrowerGroups = {}
      borrowings.forEach((borrowing) => {
        const email = borrowing.email
        if (!borrowerGroups[email]) {
          borrowerGroups[email] = {
            borrowerInfo: {
              borrowerName: borrowing.borrowerName,
              email: borrowing.email,
              phone: borrowing.phone,
              relationship: borrowing.relationship,
            },
            activeBorrowings: [],
          }
        }
        borrowerGroups[email].activeBorrowings.push(borrowing)
      })

      const borrowerResults = Object.values(borrowerGroups)

      return res.status(200).json({
        success: true,
        type: "borrower",
        data: borrowerResults[0], // Return most relevant borrower
      })
    }

    // If no borrower found, search for toys
    const toys = await Toy.find({
      $or: [{ name: { $regex: search, $options: "i" } }, { category: { $regex: search, $options: "i" } }],
    }).select("name category image description")

    if (toys.length > 0) {
      const toy = toys[0]

      // Get active borrowings for this toy
      const toyBorrowings = await ToyBorrowing.find({
        toyId: toy._id,
        returnDate: { $exists: false },
      })
        .populate({
          path: "toyId",
          select: "name category image",
        })
        .populate({
          path: "toyUnitId",
          select: "unitNumber condition",
        })
        .sort({ dueDate: 1 })

      return res.status(200).json({
        success: true,
        type: "toy",
        data: {
          toyInfo: toy,
          activeBorrowings: toyBorrowings,
        },
      })
    }

    // No results found
    res.status(404).json({
      success: false,
      error: "No active borrowings found for this search",
    })
  } catch (err) {
    console.error("Smart search error:", err)
    res.status(500).json({
      success: false,
      error: "Server Error",
    })
  }
}

// @desc    Process multiple returns at once
// @route   POST /api/process-return/process-multiple
// @access  Private
exports.processMultipleReturns = async (req, res) => {
  try {
    // Validation
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      })
    }

    const { borrowingIds, conditionOnReturn, notes, returnDate } = req.body

    if (!borrowingIds || !Array.isArray(borrowingIds) || borrowingIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide at least one borrowing ID",
      })
    }

    if (!conditionOnReturn) {
      return res.status(400).json({
        success: false,
        error: "Condition on return is required",
      })
    }

    const validConditions = ["Excellent", "Good", "Fair", "Needs Repair", "Damaged"]
    if (!validConditions.includes(conditionOnReturn)) {
      return res.status(400).json({
        success: false,
        error: "Invalid condition value",
      })
    }

    const processedReturns = []
    const errors_list = []

    // Process each return
    for (const borrowingId of borrowingIds) {
      try {
        // Get the borrowing record
        const borrowing = await ToyBorrowing.findById(borrowingId)
        if (!borrowing) {
          errors_list.push(`Borrowing ${borrowingId} not found`)
          continue
        }

        // Check if already returned
        if (borrowing.returnDate) {
          errors_list.push(`Borrowing ${borrowingId} has already been returned`)
          continue
        }

        // Update borrowing record
        borrowing.returnDate = returnDate ? new Date(returnDate) : new Date()
        borrowing.status = "Returned"
        borrowing.conditionOnReturn = conditionOnReturn
        borrowing.notes = notes
          ? `${borrowing.notes ? borrowing.notes + ". " : ""}Return notes: ${notes}`
          : borrowing.notes
        borrowing.returnProcessedBy = req.user ? req.user._id : null

        await borrowing.save()

        // Update toy unit availability
        const toyUnit = await ToyUnit.findById(borrowing.toyUnitId)
        if (toyUnit) {
          toyUnit.isAvailable = true
          toyUnit.condition = conditionOnReturn
          toyUnit.currentBorrower = null
          await toyUnit.save()
        }

        // Update toy's available units count
        const toy = await Toy.findById(borrowing.toyId)
        if (toy && toy.updateAvailableUnits) {
          await toy.updateAvailableUnits()
        }

        processedReturns.push({
          borrowingId: borrowing._id,
          toyName: toy ? toy.name : "Unknown",
          borrowerName: borrowing.borrowerName,
          status: "success",
        })
      } catch (error) {
        console.error(`Error processing return for ${borrowingId}:`, error)
        errors_list.push(`Failed to process return for ${borrowingId}: ${error.message}`)
      }
    }

    // Return results
    const response = {
      success: processedReturns.length > 0,
      processedCount: processedReturns.length,
      totalCount: borrowingIds.length,
      processedReturns,
    }

    if (errors_list.length > 0) {
      response.errors = errors_list
    }

    if (processedReturns.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No returns were processed successfully",
        errors: errors_list,
      })
    }

    res.status(200).json(response)
  } catch (err) {
    console.error("Process multiple returns error:", err)
    res.status(500).json({
      success: false,
      error: "Server Error",
    })
  }
}

// Validation middleware for bulk processing
exports.processReturnValidation = [
  body("borrowingIds").isArray({ min: 1 }).withMessage("At least one borrowing ID is required"),
  body("conditionOnReturn")
    .notEmpty()
    .withMessage("Condition on return is required")
    .isIn(["Excellent", "Good", "Fair", "Needs Repair", "Damaged"])
    .withMessage("Invalid condition"),
  body("notes").optional().trim(),
  body("returnDate").optional().isISO8601().withMessage("Invalid date format"),
]

// ============================================
// ROUTES SETUP
// Add these routes to your Express app
// ============================================

// If you're adding to server.js directly:
/*
app.get('/api/process-return/smart-search', protect, authorize('admin', 'staff'), smartSearch);
app.post('/api/process-return/process-multiple', protect, authorize('admin', 'staff'), processReturnValidation, processMultipleReturns);
*/

// If you're creating a separate route file (recommended):
/*
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/smart-search', protect, authorize('admin', 'staff'), smartSearch);
router.post('/process-multiple', protect, authorize('admin', 'staff'), processReturnValidation, processMultipleReturns);

module.exports = router;

// Then in server.js:
app.use('/api/process-return', require('./routes/processReturnRoutes'));
*/

// Export functions if using separate files
