


const Toy = require("../models/Toy");
const ToyUnit = require("../models/ToyUnit");
const ToyBorrowing = require("../models/ToyBorrowing");
const { body, validationResult } = require("express-validator");

// Validation middleware
exports.toyValidation = [
  body("name").notEmpty().withMessage("Toy name is required").trim(),
  body("category").notEmpty().withMessage("Category is required").trim(),
  body("description").optional().trim(),
];

exports.toyUnitValidation = [
  body("unitNumber")
    .notEmpty()
    .withMessage("Unit number is required")
    .isNumeric()
    .withMessage("Unit number must be a number"),
  body("condition")
    .optional()
    .isIn(["Excellent", "Good", "Fair", "Needs Repair", "Damaged"])
    .withMessage("Invalid condition"),
  body("notes").optional().trim(),
];

// @desc    Get all toys
// @route   GET /api/toys
// @access  Private
exports.getToys = async (req, res) => {
  try {
    const query = {};

    // Add search functionality
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { category: { $regex: req.query.search, $options: "i" } },
      ];
    }

    // Add category filter
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Add availability filter
    if (req.query.availability === "available") {
      query.availableUnits = { $gt: 0 };
    } else if (req.query.availability === "unavailable") {
      query.availableUnits = 0;
    }

    const toys = await Toy.find(query).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: toys.length,
      data: toys,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Get single toy with units
// @route   GET /api/toys/:id
// @access  Private
exports.getToy = async (req, res) => {
  try {
    const toy = await Toy.findById(req.params.id);

    if (!toy) {
      return res.status(404).json({
        success: false,
        error: "Toy not found",
      });
    }

    // Get units for this toy
    const units = await ToyUnit.find({ toyId: toy._id }).sort({
      unitNumber: 1,
    });

    // Get borrowing history
    const borrowingHistory = await ToyBorrowing.find({ toyId: toy._id })
      .sort({ issueDate: -1 })
      .populate("toyUnitId", "unitNumber")
      .select("toyUnitId borrowerName issueDate dueDate returnDate status");

    res.status(200).json({
      success: true,
      data: {
        toy,
        units,
        borrowingHistory,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Create new toy
// @route   POST /api/toys
// @access  Private
exports.createToy = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Create toy
    const toy = new Toy({
      name: req.body.name,
      category: req.body.category,
      description: req.body.description,
      totalUnits: 0,
      availableUnits: 0,
      image: req.body.image,
      createdBy: req.user._id,
    });

    await toy.save();

    // Create toy units if specified
    if (req.body.units && req.body.units > 0) {
      const unitsToCreate = [];
      for (let i = 1; i <= req.body.units; i++) {
        unitsToCreate.push({
          toyId: toy._id,
          unitNumber: i,
          condition: "Good",
          isAvailable: true,
        });
      }

      if (unitsToCreate.length > 0) {
        await ToyUnit.insertMany(unitsToCreate);

        // Update the toy's unit counts
        toy.totalUnits = unitsToCreate.length;
        toy.availableUnits = unitsToCreate.length;
        await toy.save();
      }
    }

    res.status(201).json({
      success: true,
      data: toy,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Update toy
// @route   PUT /api/toys/:id
// @access  Private
exports.updateToy = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    let toy = await Toy.findById(req.params.id);

    if (!toy) {
      return res.status(404).json({
        success: false,
        error: "Toy not found",
      });
    }

    // Update fields
    toy.name = req.body.name || toy.name;
    toy.category = req.body.category || toy.category;
    toy.description = req.body.description || toy.description;
    toy.image = req.body.image || toy.image;
    toy.updatedBy = req.user._id;

    await toy.save();

    res.status(200).json({
      success: true,
      data: toy,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Delete toy
// @route   DELETE /api/toys/:id
// @access  Private
exports.deleteToy = async (req, res) => {
  try {
    const toy = await Toy.findById(req.params.id);

    if (!toy) {
      return res.status(404).json({
        success: false,
        error: "Toy not found",
      });
    }

    // Check if the toy has any active borrowings
    const activeBorrowings = await ToyBorrowing.countDocuments({
      toyId: toy._id,
      returnDate: { $exists: false },
    });

    if (activeBorrowings > 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete toy with active borrowings",
      });
    }

    // Delete all units
    await ToyUnit.deleteMany({ toyId: toy._id });

    // Delete the toy
    await toy.deleteOne();

    res.status(200).json({
      success: true,
      message: "Toy deleted successfully",
      data: {},
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Add toy unit
// @route   POST /api/toys/:id/units
// @access  Private
exports.addToyUnit = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const toy = await Toy.findById(req.params.toyId);

    if (!toy) {
      return res.status(404).json({
        success: false,
        error: "Toy not found",
      });
    }

    // Check if unit number already exists
    const existingUnit = await ToyUnit.findOne({
      toyId: toy._id,
      unitNumber: req.body.unitNumber,
    });

    if (existingUnit) {
      return res.status(400).json({
        success: false,
        error: "Unit number already exists",
      });
    }

    // Create toy unit
    const toyUnit = new ToyUnit({
      toyId: toy._id,
      unitNumber: req.body.unitNumber,
      condition: req.body.condition || "Good",
      isAvailable: true,
      notes: req.body.notes,
    });

    await toyUnit.save();

    // Update toy counts
    toy.totalUnits += 1;
    toy.availableUnits += 1;
    await toy.save();

    res.status(201).json({
      success: true,
      data: toyUnit,
    });
  } catch (err) {
    console.error("Add Toy Unit error:", err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Update toy unit
// @route   PUT /api/toys/units/:id
// @access  Private
exports.updateToyUnit = async (req, res) => {
  try {
    const errors = validationResult(req)

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      })
    }

    const toyUnit = await ToyUnit.findById(req.params.id)

    if (!toyUnit) {
      return res.status(404).json({
        success: false,
        error: "Toy unit not found",
      })
    }

    // Check if it's currently borrowed
    if (!toyUnit.isAvailable && req.body.condition) {
      return res.status(400).json({
        success: false,
        error: "Cannot update condition of a borrowed toy unit",
      })
    }

    // Check for unit number conflicts if unit number is being updated
    if (req.body.unitNumber && req.body.unitNumber !== toyUnit.unitNumber) {
      const existingUnit = await ToyUnit.findOne({
        toyId: toyUnit.toyId,
        unitNumber: req.body.unitNumber,
        _id: { $ne: req.params.id }, // Exclude current unit
      })

      if (existingUnit) {
        return res.status(400).json({
          success: false,
          error: `Unit number ${req.body.unitNumber} already exists for this toy`,
        })
      }
    }

    // Update fields
    if (req.body.unitNumber) {
      toyUnit.unitNumber = req.body.unitNumber
    }

    if (req.body.condition) {
      toyUnit.condition = req.body.condition
    }

    if (req.body.notes !== undefined) {
      // Allow empty string
      toyUnit.notes = req.body.notes
    }

    // Update timestamp
    toyUnit.updatedAt = new Date()

    await toyUnit.save()

    // Populate toy details for response
    await toyUnit.populate("toyId", "name category")

    res.status(200).json({
      success: true,
      data: toyUnit,
    })
  } catch (err) {
    console.error("Update toy unit error:", err)
    res.status(500).json({
      success: false,
      error: "Server Error",
    })
  }
}

// @desc    Delete toy unit
// @route   DELETE /api/toys/units/:id
// @access  Private
exports.deleteToyUnit = async (req, res) => {
  try {
    const toyUnit = await ToyUnit.findById(req.params.id);

    if (!toyUnit) {
      return res.status(404).json({
        success: false,
        error: "Toy unit not found",
      });
    }

    // Check if it's currently borrowed
    if (!toyUnit.isAvailable) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete a borrowed toy unit",
      });
    }

    // Get the toy to update counts
    const toy = await Toy.findById(toyUnit.toyId);

    // Delete the unit
    await toyUnit.deleteOne();

    if (toy) {
      // Update toy counts
      toy.totalUnits -= 1;
      if (toyUnit.isAvailable) {
        toy.availableUnits -= 1;
      }
      await toy.save();
    }

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

// @desc    Get toy borrowing history
// @route   GET /api/toys/:id/borrowing-history
// @access  Private
exports.getToyBorrowingHistory = async (req, res) => {
  try {
    const toy = await Toy.findById(req.params.id);

    if (!toy) {
      return res.status(404).json({
        success: false,
        error: "Toy not found",
      });
    }
    console.log("Toy _id for history query:", toy._id); //debug

    // Get borrowing history for this toy
    // Get borrowing history
    const borrowings = await ToyBorrowing.find({ toyId: toy._id })
      .sort({ issueDate: -1 })
      .populate("toyUnitId", "unitNumber")
      .populate({
        path: "issuedBy",
        select: "firstName lastName",
        options: { strictPopulate: false },
      })
      .populate({
        path: "returnProcessedBy",
        select: "firstName lastName",
        options: { strictPopulate: false },
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

// @desc    Get categories
// @route   GET /api/toys/categories
// @access  Private
exports.getCategories = async (req, res) => {
  try {
    const categories = await Toy.distinct("category");

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};




// @desc    Get all units for a specific toy
// @route   GET /api/toys/:toyId/units
// @access  Private
exports.getToyUnits = async (req, res) => {
  try {
    const { toyId } = req.params

    // Check if toy exists
    const toy = await Toy.findById(toyId)
    if (!toy) {
      return res.status(404).json({
        success: false,
        error: "Toy not found",
      })
    }

    // Get all units for this toy
    const units = await ToyUnit.find({ toyId }).sort({ unitNumber: 1 })

    res.status(200).json({
      success: true,
      count: units.length,
      data: units,
    })
  } catch (err) {
    console.error("Get toy units error:", err)
    res.status(500).json({
      success: false,
      error: "Server Error",
    })
  }
}

// @desc    Get unit by ID
// @route   GET /api/toys/units/:id
// @access  Private
exports.getToyUnit = async (req, res) => {
  try {
    const unit = await ToyUnit.findById(req.params.id).populate("toyId", "name category")

    if (!unit) {
      return res.status(404).json({
        success: false,
        error: "Unit not found",
      })
    }

    res.status(200).json({
      success: true,
      data: unit,
    })
  } catch (err) {
    console.error("Get toy unit error:", err)
    res.status(500).json({
      success: false,
      error: "Server Error",
    })
  }
}


exports.toySearch = async (req, res) => {
  try {
    const { search } = req.query

    const query = {}
    if (search) {
      query.$or = [{ name: { $regex: search, $options: "i" } }, { category: { $regex: search, $options: "i" } }]
    }

    const toys = await Toy.find(query)
      .select("name category availableUnits image")
      .where("availableUnits")
      .gt(0)
      .limit(10)

    res.json({
      success: true,
      data: toys,
    })
  } catch (error) {
    // console.log(error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}