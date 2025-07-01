
const Toy = require("../models/Toy") // Import Toy model
const express = require("express");
const Borrowing = require("../models/ToyBorrowing") // Import Borrowing model
const ToyUnit = require("../models/ToyUnit"); // Import ToyUnit model



exports.ToyStats = async (req, res) => {
  try {
    // Get total available toys (sum of all available units)
    const toys = await Toy.find().populate("units")
    const toysAvailable = toys.reduce((total, toy) => {
      const availableUnits = toy.units.filter((unit) => unit.isAvailable).length
      return total + availableUnits
    }, 0)

    // Get active borrowings count
    const activeBorrowings = await Borrowing.countDocuments({
      status: "Borrowed",
    })

    // Get due soon count (due within 3 days)
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const dueSoon = await Borrowing.countDocuments({
      status: "Borrowed",
      dueDate: {
        $gte: new Date(),
        $lte: threeDaysFromNow,
      },
    })

    // Get overdue count
    const overdue = await Borrowing.countDocuments({
      status: "Borrowed",
      dueDate: { $lt: new Date() },
    })

    res.json({
      success: true,
      data: {
        toysAvailable,
        toysBorrowed: activeBorrowings,
        dueSoon,
        overdue,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

exports.getBorrowedToys =  async (req, res) => {
  try {
    const { search } = req.query

    const query = { status: "Borrowed" }

    // Add search functionality
    if (search) {
      query.$or = [
        { borrowerName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ]
    }

    const borrowedToys = await Borrowing.find(query)
      .populate({
        path: "toyId",
        select: "name category image",
      })
      .populate({
        path: "toyUnitId",
        select: "unitNumber condition",
      })
      .sort({ issueDate: -1 })
      .limit(50) // Limit for performance

    // Calculate status for each borrowing
    const borrowedToysWithStatus = borrowedToys.map((borrowing) => {
      const today = new Date()
      const dueDate = new Date(borrowing.dueDate)
      const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)

      let status = "Active"
      if (dueDate < today) {
        status = "Overdue"
      } else if (dueDate <= threeDaysFromNow) {
        status = "Due Soon"
      }

      return {
        _id: borrowing._id,
        toyId: borrowing.toyId,
        toyUnitId: borrowing.toyUnitId,
        borrowerName: borrowing.borrowerName,
        email: borrowing.email,
        phone: borrowing.phone,
        relationship: borrowing.relationship,
        issueDate: borrowing.issueDate,
        dueDate: borrowing.dueDate,
        notes: borrowing.notes,
        status: status,
        conditionOnIssue: borrowing.conditionOnIssue,
      }
    })

    res.json({
      success: true,
      count: borrowedToysWithStatus.length,
      data: borrowedToysWithStatus,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

exports.sendRemainder = async (req, res) => {
  try {
    const { borrowingId } = req.body

    const borrowing = await Borrowing.findById(borrowingId)
      .populate("toyId", "name")
      .populate("toyUnitId", "unitNumber")

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        error: "Borrowing not found",
      })
    }

    // Here you would implement actual email sending
    // For now, we'll just log and return success
    console.log(`Sending reminder to ${borrowing.email} for ${borrowing.toyId.name}`)

    // You can integrate with services like SendGrid, Nodemailer, etc.
    // Example with nodemailer:
    /*
    const transporter = nodemailer.createTransporter({...});
    await transporter.sendMail({
      to: borrowing.email,
      subject: `Reminder: ${borrowing.toyId.name} Return Due`,
      html: `
        <p>Dear ${borrowing.borrowerName},</p>
        <p>This is a friendly reminder that the toy "${borrowing.toyId.name}" (Unit #${borrowing.toyUnitId.unitNumber}) is due for return on ${new Date(borrowing.dueDate).toLocaleDateString()}.</p>
        <p>Please return it at your earliest convenience.</p>
        <p>Thank you!</p>
      `
    });
    */

    res.json({
      success: true,
      message: "Reminder sent successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

exports.getBorrowingById = async (req, res) => {
  try {
    const { borrowingId } = req.params
    const { conditionOnReturn = "Good", returnNotes = "" } = req.body

    const borrowing = await Borrowing.findById(borrowingId).populate("toyUnitId")

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        error: "Borrowing not found",
      })
    }

    if (borrowing.status !== "Borrowed") {
      return res.status(400).json({
        success: false,
        error: "Toy is not currently borrowed",
      })
    }

    // Update borrowing record
    borrowing.status = "Returned"
    borrowing.returnDate = new Date()
    borrowing.conditionOnReturn = conditionOnReturn
    borrowing.returnNotes = returnNotes
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
    if (toy) {
      const availableUnits = await ToyUnit.countDocuments({
        toyId: toy._id,
        isAvailable: true,
      })
      toy.availableUnits = availableUnits
      await toy.save()
    }

    res.json({
      success: true,
      message: "Toy returned successfully",
      data: borrowing,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

exports.getToyDetails = async (req, res) => {
  try {
    const { toyId } = req.params

    const toy = await Toy.findById(toyId).populate("units")

    if (!toy) {
      return res.status(404).json({
        success: false,
        error: "Toy not found",
      })
    }

    // Get borrowing history for this toy
    const borrowingHistory = await Borrowing.find({ toyId: toyId })
      .populate("toyUnitId", "unitNumber")
      .sort({ issueDate: -1 })
      .limit(10)

    // Get current borrowings for this toy
    const currentBorrowings = await Borrowing.find({
      toyId: toyId,
      status: "Borrowed",
    })
      .populate("toyUnitId", "unitNumber")
      .sort({ issueDate: -1 })

    res.json({
      success: true,
      data: {
        toy,
        units: toy.units,
        borrowingHistory,
        currentBorrowings,
        totalBorrowings: borrowingHistory.length,
        activeBorrowings: currentBorrowings.length,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

exports.getAllBorrowers = async (req, res) => {
  try {
    const { search } = req.query

    // Build aggregation pipeline to get unique borrowers with their current borrowings
    const pipeline = [
      {
        $match: {
          status: "Borrowed",
        },
      },
      {
        $lookup: {
          from: "toys",
          localField: "toyId",
          foreignField: "_id",
          as: "toyDetails",
        },
      },
      {
        $lookup: {
          from: "toyunits",
          localField: "toyUnitId",
          foreignField: "_id",
          as: "unitDetails",
        },
      },
      {
        $unwind: "$toyDetails",
      },
      {
        $unwind: "$unitDetails",
      },
    ]

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { borrowerName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { "toyDetails.name": { $regex: search, $options: "i" } },
          ],
        },
      })
    }

    // Group by borrower to get their current borrowings
    pipeline.push(
      {
        $group: {
          _id: {
            borrowerName: "$borrowerName",
            email: "$email",
            phone: "$phone",
            relationship: "$relationship",
          },
          borrowings: {
            $push: {
              borrowingId: "$_id",
              toyName: "$toyDetails.name",
              toyCategory: "$toyDetails.category",
              toyImage: "$toyDetails.image",
              unitNumber: "$unitDetails.unitNumber",
              issueDate: "$issueDate",
              dueDate: "$dueDate",
              status: "$status",
              conditionOnIssue: "$conditionOnIssue",
            },
          },
          totalBorrowed: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.borrowerName": 1 },
      },
    )

    const borrowers = await Borrowing.aggregate(pipeline)

    // Calculate status for each borrowing
    const borrowersWithStatus = borrowers.map((borrower) => {
      const borrowingsWithStatus = borrower.borrowings.map((borrowing) => {
        const today = new Date()
        const dueDate = new Date(borrowing.dueDate)
        const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)

        let status = "Active"
        if (dueDate < today) {
          status = "Overdue"
        } else if (dueDate <= threeDaysFromNow) {
          status = "Due Soon"
        }

        return { ...borrowing, calculatedStatus: status }
      })

      return {
        ...borrower._id,
        borrowings: borrowingsWithStatus,
        totalBorrowed: borrower.totalBorrowed,
      }
    })

    res.json({
      success: true,
      count: borrowersWithStatus.length,
      data: borrowersWithStatus,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

exports.getBorrowerByEmail  = async (req, res) => {
  try {
    const { borrowerEmail } = req.params

    // Get borrower's current borrowings
    const currentBorrowings = await Borrowing.find({
      email: borrowerEmail,
      status: "Borrowed",
    })
      .populate("toyId", "name category image")
      .populate("toyUnitId", "unitNumber condition")
      .sort({ issueDate: -1 })

    // Get borrower's borrowing history
    const borrowingHistory = await Borrowing.find({
      email: borrowerEmail,
    })
      .populate("toyId", "name category image")
      .populate("toyUnitId", "unitNumber condition")
      .sort({ issueDate: -1 })
      .limit(20)

    if (borrowingHistory.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Borrower not found",
      })
    }

    // Get borrower info from the most recent record
    const borrowerInfo = {
      borrowerName: borrowingHistory[0].borrowerName,
      email: borrowingHistory[0].email,
      phone: borrowingHistory[0].phone,
      relationship: borrowingHistory[0].relationship,
    }

    // Calculate status for current borrowings
    const currentBorrowingsWithStatus = currentBorrowings.map((borrowing) => {
      const today = new Date()
      const dueDate = new Date(borrowing.dueDate)
      const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)

      let status = "Active"
      if (dueDate < today) {
        status = "Overdue"
      } else if (dueDate <= threeDaysFromNow) {
        status = "Due Soon"
      }

      return { ...borrowing.toObject(), calculatedStatus: status }
    })

    // Calculate status for history
    const historyWithStatus = borrowingHistory.map((borrowing) => {
      if (borrowing.status === "Returned") {
        const returnDate = new Date(borrowing.returnDate)
        const dueDate = new Date(borrowing.dueDate)

        if (returnDate <= dueDate) {
          return { ...borrowing.toObject(), calculatedStatus: "Returned On Time" }
        } else {
          const daysLate = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24))
          return { ...borrowing.toObject(), calculatedStatus: `Returned Late (${daysLate} Days)` }
        }
      }
      return { ...borrowing.toObject(), calculatedStatus: borrowing.status }
    })

    res.json({
      success: true,
      data: {
        borrowerInfo,
        currentBorrowings: currentBorrowingsWithStatus,
        borrowingHistory: historyWithStatus,
        totalBorrowings: borrowingHistory.length,
        activeBorrowings: currentBorrowings.length,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

exports.sendRemainderToEmail = async (req, res) => {
  try {
    const { borrowerEmail } = req.params
    const { borrowingId } = req.body

    const borrowing = await Borrowing.findById(borrowingId)
      .populate("toyId", "name")
      .populate("toyUnitId", "unitNumber")

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        error: "Borrowing not found",
      })
    }

    if (borrowing.email !== borrowerEmail) {
      return res.status(400).json({
        success: false,
        error: "Borrowing does not belong to this borrower",
      })
    }

    // Here you would implement actual email sending
    console.log(`Sending reminder to ${borrowing.email} for ${borrowing.toyId.name}`)

    res.json({
      success: true,
      message: "Reminder sent successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

exports.getBorrowersById = async (req, res) => {
  try {
    const { borrowerId } = req.params;

    console.log(borrowerId)

    // Get the specific borrowing record
    const mainBorrowing = await Borrowing.findById(borrowerId)
      .populate("toyId")
      .populate("toyUnitId");

    if (!mainBorrowing) {
      return res.status(404).json({
        success: false,
        error: "Borrowing record not found",
      });
    }

    const borrowerEmail = mainBorrowing.email;

    // Get all borrowings for this borrower
    const allBorrowings = await Borrowing.find({
      email: borrowerEmail,
    })
      .populate("toyId")
      .populate("toyUnitId")
      .sort({ issueDate: -1 });

    // Clean the data to avoid object rendering issues
    const cleanBorrowings = allBorrowings.map((borrowing) => {
      const today = new Date();
      const dueDate = new Date(borrowing.dueDate);
      let calculatedStatus = "Active";

      if (borrowing.returnDate) {
        const returnDate = new Date(borrowing.returnDate);
        calculatedStatus = returnDate <= dueDate ? "Returned On Time" : "Returned Late";
      } else if (dueDate < today) {
        calculatedStatus = "Overdue";
      } else if (dueDate <= new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)) {
        calculatedStatus = "Due Soon";
      }

      return {
        _id: String(borrowing._id),
        toyName: borrowing.toyId ? String(borrowing.toyId.name) : "Unknown Toy",
        toyCategory: borrowing.toyId ? String(borrowing.toyId.category) : "Unknown",
        toyImage: borrowing.toyId && borrowing.toyId.image ? String(borrowing.toyId.image) : null,
        unitNumber: borrowing.toyUnitId ? Number(borrowing.toyUnitId.unitNumber) : 0,
        unitCondition: borrowing.toyUnitId ? String(borrowing.toyUnitId.condition) : "Unknown",
        issueDate: String(borrowing.issueDate),
        dueDate: String(borrowing.dueDate),
        returnDate: borrowing.returnDate ? String(borrowing.returnDate) : null,
        status: String(borrowing.status),
        calculatedStatus: String(calculatedStatus),
        notes: borrowing.notes ? String(borrowing.notes) : null,
      };
    });

    const currentBorrowings = cleanBorrowings.filter((b) => !b.returnDate);

    const response = {
      success: true,
      data: {
        borrowerInfo: {
          borrowerName: String(mainBorrowing.borrowerName),
          email: String(mainBorrowing.email),
          phone: String(mainBorrowing.phone),
          relationship: String(mainBorrowing.relationship),
        },
        currentBorrowings: currentBorrowings,
        borrowingHistory: cleanBorrowings,
        totalBorrowings: Number(allBorrowings.length),
        activeBorrowings: Number(currentBorrowings.length),
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching borrower details:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
}

exports.sendRemainderByBororrwerId = async (req, res) => {
  try {
    const { borrowerId } = req.params;
    console.log(`Sending reminder for borrowing ID: ${borrowerId}`);

    res.json({
      success: true,
      message: "Reminder sent successfully",
    });
  } catch (error) {
    console.error("Error sending reminder:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
}

// exports.getAvailableUnits = 