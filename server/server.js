const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const helmet = require("helmet");
const xss = require("xss-clean");
const hpp = require("hpp");
// const rateLimit = require("express-rate-limit");
const fileUpload = require("express-fileupload");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const startOverdueUpdateJob = require("./utils/cronJob");

// Import routes
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const courseRoutes = require("./routes/courseRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const webinarRoutes = require("./routes/webinarRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const patientRoutes = require("./routes/patientRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const toyRoutes = require("./routes/toyRoutes");
const borrowerRoutes = require("./routes/borrowerRoutes");
const ToymanagementRoutes = require("./routes/ToymanagementDashboardRoutes");
// Add missing route imports
const serviceRoutes = require("./routes/serviceRoutes");
const therapistRoutes = require("./routes/therapistRoutes");
const jobRoutes = require("./routes/jobRoutes");
const jobApplicationRoutes = require("./routes/jobApplicationRoutes");
const blogRoutes = require("./routes/blogRoutes");
// Comment out or remove the inventoryRoutes import
// const inventoryRoutes = require("./routes/inventoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const discountRoutes = require("./routes/discountRoutes");
// Add new routes
const galleryRoutes = require("./routes/galleryRoutes");
const diseaseRoutes = require("./routes/diseaseRoutes");
//Add shipping-routes
const paymentRoutes = require("./routes/paymentRoutes")
const shippingRoutes = require("./routes/orderRoutes");
const {
  smartSearch,
  processMultipleReturns,
  processReturnValidation,
} = require("./controllers/borrowerController");

//email
const emailRoutes = require("./routes/emailRoutes");
//recipe
const recipeRoutes = require("./routes/recipeRoutes");
//workshop
const workshopRoutes = require("./routes/workshopRoutes");
//adminRoutes
const adminRoutes = require("./routes/adminRoutes");
//detoxRoutes
const detoxRoutes = require("./routes/detoxRoutes");

// Load env vars
dotenv.config({ path: "./config/config.env" });

// Connect to database
connectDB();
//Start the cron job
startOverdueUpdateJob();

const app = express();

// Body parser with increased limits for handling file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Cookie parser
app.use(cookieParser());

// Dev logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Sanitize data
app.use(mongoSanitize());

// Set security headers
app.use(helmet());

// Prevent XSS attacks
app.use(xss());

// Prevent http param pollution
app.use(hpp());

// Enable CORS
const corsOptions = {
  origin: ["http://localhost:3000", "http://localhost:3001"],
  methods: ["GET", "POST", "PUT", "DELETE"],
};

app.use(cors(corsOptions));

// Rate limiting
// const limiter = rateLimit({
//   windowMs: 10 * 60 * 1000, // 10 mins
//   max: 100,
// });
// app.use(limiter);

// Test API
app.get("/api/test", (req, res) => {
  res.status(200).json({ success: true, message: "API is working!" });
});

// Mount routes
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/webinars", webinarRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/toys", toyRoutes);
app.use("/api/borrowers", borrowerRoutes);
// Mount missing routes
app.use("/api/services", serviceRoutes);
app.use("/api/therapists", therapistRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/job-applications", jobApplicationRoutes);
app.use("/api/blogs", blogRoutes);
// Comment out or remove the inventoryRoutes usage
// app.use("/api/inventory", inventoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/discounts", discountRoutes);
// Mount new routes
app.use("/api/gallery", galleryRoutes);
app.use("/api/diseases", diseaseRoutes);
//shipping routes for admin dash
app.use("/api/shipping", shippingRoutes);
app.use("/api", ToymanagementRoutes);
//email route
app.use("/api/emails", emailRoutes);
//recipe and workshop
app.use("/api/recipes", recipeRoutes);
app.use("/api/workshops", workshopRoutes);
//admin routes
app.use("/api/admin", adminRoutes);
//detox routes
app.use("/api/detox", detoxRoutes);
app.use("/api/payments", paymentRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("Backend Server was stated and successfully running...");
});

// Error handler
app.use(errorHandler);

const PORT = 5000;

const server = app.listen(
  PORT,
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// app.get("/api/process-return/smart-search", protect, authorize("admin", "staff"), smartSearch)
// app.post(
//   "/api/process-return/process-multiple",
//   protect,
//   authorize("admin", "staff"),
//   processReturnValidation,
//   processMultipleReturns,
// )

// UserDashboard :

// // these are sample api routes added in the server file thesse will be distrubeed after
// // Dashboard API Routes - Add these to your Express backend

// // GET /api/dashboard/stats - Get dashboard statistics

// // GET /api/dashboard/borrowed-toys - Get all borrowed toys for dashboard table
// app.get("/api/dashboard/borrowed-toys", async (req, res) => {
//   try {
//     const { search } = req.query

//     const query = { status: "Borrowed" }

//     // Add search functionality
//     if (search) {
//       query.$or = [
//         { borrowerName: { $regex: search, $options: "i" } },
//         { email: { $regex: search, $options: "i" } },
//         { phone: { $regex: search, $options: "i" } },
//       ]
//     }

//     const borrowedToys = await Borrowing.find(query)
//       .populate({
//         path: "toyId",
//         select: "name category image",
//       })
//       .populate({
//         path: "toyUnitId",
//         select: "unitNumber condition",
//       })
//       .sort({ issueDate: -1 })
//       .limit(50) // Limit for performance

//     // Calculate status for each borrowing
//     const borrowedToysWithStatus = borrowedToys.map((borrowing) => {
//       const today = new Date()
//       const dueDate = new Date(borrowing.dueDate)
//       const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)

//       let status = "Active"
//       if (dueDate < today) {
//         status = "Overdue"
//       } else if (dueDate <= threeDaysFromNow) {
//         status = "Due Soon"
//       }

//       return {
//         _id: borrowing._id,
//         toyId: borrowing.toyId,
//         toyUnitId: borrowing.toyUnitId,
//         borrowerName: borrowing.borrowerName,
//         email: borrowing.email,
//         phone: borrowing.phone,
//         relationship: borrowing.relationship,
//         issueDate: borrowing.issueDate,
//         dueDate: borrowing.dueDate,
//         notes: borrowing.notes,
//         status: status,
//         conditionOnIssue: borrowing.conditionOnIssue,
//       }
//     })

//     res.json({
//       success: true,
//       count: borrowedToysWithStatus.length,
//       data: borrowedToysWithStatus,
//     })
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     })
//   }
// })

// // POST /api/dashboard/send-reminder - Send reminder to borrower
// app.post("/api/dashboard/send-reminder", async (req, res) => {
//   try {
//     const { borrowingId } = req.body

//     const borrowing = await Borrowing.findById(borrowingId)
//       .populate("toyId", "name")
//       .populate("toyUnitId", "unitNumber")

//     if (!borrowing) {
//       return res.status(404).json({
//         success: false,
//         error: "Borrowing not found",
//       })
//     }

//     // Here you would implement actual email sending
//     // For now, we'll just log and return success
//     console.log(`Sending reminder to ${borrowing.email} for ${borrowing.toyId.name}`)

//     // You can integrate with services like SendGrid, Nodemailer, etc.
//     // Example with nodemailer:
//     /*
//     const transporter = nodemailer.createTransporter({...});
//     await transporter.sendMail({
//       to: borrowing.email,
//       subject: `Reminder: ${borrowing.toyId.name} Return Due`,
//       html: `
//         <p>Dear ${borrowing.borrowerName},</p>
//         <p>This is a friendly reminder that the toy "${borrowing.toyId.name}" (Unit #${borrowing.toyUnitId.unitNumber}) is due for return on ${new Date(borrowing.dueDate).toLocaleDateString()}.</p>
//         <p>Please return it at your earliest convenience.</p>
//         <p>Thank you!</p>
//       `
//     });
//     */

//     res.json({
//       success: true,
//       message: "Reminder sent successfully",
//     })
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     })
//   }
// })

// // PUT /api/dashboard/process-return/:borrowingId - Process toy return
// app.put("/api/dashboard/process-return/:borrowingId", async (req, res) => {
//   try {
//     const { borrowingId } = req.params
//     const { conditionOnReturn = "Good", returnNotes = "" } = req.body

//     const borrowing = await Borrowing.findById(borrowingId).populate("toyUnitId")

//     if (!borrowing) {
//       return res.status(404).json({
//         success: false,
//         error: "Borrowing not found",
//       })
//     }

//     if (borrowing.status !== "Borrowed") {
//       return res.status(400).json({
//         success: false,
//         error: "Toy is not currently borrowed",
//       })
//     }

//     // Update borrowing record
//     borrowing.status = "Returned"
//     borrowing.returnDate = new Date()
//     borrowing.conditionOnReturn = conditionOnReturn
//     borrowing.returnNotes = returnNotes
//     await borrowing.save()

//     // Update toy unit availability
//     const toyUnit = await ToyUnit.findById(borrowing.toyUnitId)
//     if (toyUnit) {
//       toyUnit.isAvailable = true
//       toyUnit.condition = conditionOnReturn
//       toyUnit.currentBorrower = null
//       await toyUnit.save()
//     }

//     // Update toy's available units count
//     const toy = await Toy.findById(borrowing.toyId)
//     if (toy) {
//       const availableUnits = await ToyUnit.countDocuments({
//         toyId: toy._id,
//         isAvailable: true,
//       })
//       toy.availableUnits = availableUnits
//       await toy.save()
//     }

//     res.json({
//       success: true,
//       message: "Toy returned successfully",
//       data: borrowing,
//     })
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     })
//   }
// })

// // GET /api/toys/search-available - Search available toys for issuing
// app.get("/api/search-available", async (req, res) => {
//   try {
//     const { search } = req.query

//     const query = {}
//     if (search) {
//       query.$or = [{ name: { $regex: search, $options: "i" } }, { category: { $regex: search, $options: "i" } }]
//     }

//     const toys = await Toy.find(query)
//       .select("name category availableUnits image")
//       .where("availableUnits")
//       .gt(0)
//       .limit(10)

//     res.json({
//       success: true,
//       data: toys,
//     })
//   } catch (error) {
//     // console.log(error)
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     })
//   }
// })

// // GET /api/toys/:toyId/available-units - Get available units for a specific toy
// app.get("/api/toys/:toyId/available-units", async (req, res) => {
//   try {
//     const { toyId } = req.params

//     const availableUnits = await ToyUnit.find({
//       toyId: toyId,
//       isAvailable: true,
//     }).select("unitNumber condition")

//     res.json({
//       success: true,
//       data: availableUnits,
//     })
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     })
//   }
// })

// app.get("/api/toys/:toyId/details", async (req, res) => {
//   try {
//     const { toyId } = req.params

//     const toy = await Toy.findById(toyId).populate("units")

//     if (!toy) {
//       return res.status(404).json({
//         success: false,
//         error: "Toy not found",
//       })
//     }

//     // Get borrowing history for this toy
//     const borrowingHistory = await Borrowing.find({ toyId: toyId })
//       .populate("toyUnitId", "unitNumber")
//       .sort({ issueDate: -1 })
//       .limit(10)

//     // Get current borrowings for this toy
//     const currentBorrowings = await Borrowing.find({
//       toyId: toyId,
//       status: "Borrowed",
//     })
//       .populate("toyUnitId", "unitNumber")
//       .sort({ issueDate: -1 })

//     res.json({
//       success: true,
//       data: {
//         toy,
//         units: toy.units,
//         borrowingHistory,
//         currentBorrowings,
//         totalBorrowings: borrowingHistory.length,
//         activeBorrowings: currentBorrowings.length,
//       },
//     })
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     })
//   }
// })

// // GET /api/borrowers - Get all borrowers with their current borrowings
// app.get("/api/borrowers", async (req, res) => {
//   try {
//     const { search } = req.query

//     // Build aggregation pipeline to get unique borrowers with their current borrowings
//     const pipeline = [
//       {
//         $match: {
//           status: "Borrowed",
//         },
//       },
//       {
//         $lookup: {
//           from: "toys",
//           localField: "toyId",
//           foreignField: "_id",
//           as: "toyDetails",
//         },
//       },
//       {
//         $lookup: {
//           from: "toyunits",
//           localField: "toyUnitId",
//           foreignField: "_id",
//           as: "unitDetails",
//         },
//       },
//       {
//         $unwind: "$toyDetails",
//       },
//       {
//         $unwind: "$unitDetails",
//       },
//     ]

//     // Add search filter if provided
//     if (search) {
//       pipeline.push({
//         $match: {
//           $or: [
//             { borrowerName: { $regex: search, $options: "i" } },
//             { email: { $regex: search, $options: "i" } },
//             { phone: { $regex: search, $options: "i" } },
//             { "toyDetails.name": { $regex: search, $options: "i" } },
//           ],
//         },
//       })
//     }

//     // Group by borrower to get their current borrowings
//     pipeline.push(
//       {
//         $group: {
//           _id: {
//             borrowerName: "$borrowerName",
//             email: "$email",
//             phone: "$phone",
//             relationship: "$relationship",
//           },
//           borrowings: {
//             $push: {
//               borrowingId: "$_id",
//               toyName: "$toyDetails.name",
//               toyCategory: "$toyDetails.category",
//               toyImage: "$toyDetails.image",
//               unitNumber: "$unitDetails.unitNumber",
//               issueDate: "$issueDate",
//               dueDate: "$dueDate",
//               status: "$status",
//               conditionOnIssue: "$conditionOnIssue",
//             },
//           },
//           totalBorrowed: { $sum: 1 },
//         },
//       },
//       {
//         $sort: { "_id.borrowerName": 1 },
//       },
//     )

//     const borrowers = await Borrowing.aggregate(pipeline)

//     // Calculate status for each borrowing
//     const borrowersWithStatus = borrowers.map((borrower) => {
//       const borrowingsWithStatus = borrower.borrowings.map((borrowing) => {
//         const today = new Date()
//         const dueDate = new Date(borrowing.dueDate)
//         const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)

//         let status = "Active"
//         if (dueDate < today) {
//           status = "Overdue"
//         } else if (dueDate <= threeDaysFromNow) {
//           status = "Due Soon"
//         }

//         return { ...borrowing, calculatedStatus: status }
//       })

//       return {
//         ...borrower._id,
//         borrowings: borrowingsWithStatus,
//         totalBorrowed: borrower.totalBorrowed,
//       }
//     })

//     res.json({
//       success: true,
//       count: borrowersWithStatus.length,
//       data: borrowersWithStatus,
//     })
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     })
//   }
// })

// // GET /api/borrowers/:borrowerEmail - Get specific borrower details
// app.get("/api/borrowers/:borrowerEmail", async (req, res) => {
//   try {
//     const { borrowerEmail } = req.params

//     // Get borrower's current borrowings
//     const currentBorrowings = await Borrowing.find({
//       email: borrowerEmail,
//       status: "Borrowed",
//     })
//       .populate("toyId", "name category image")
//       .populate("toyUnitId", "unitNumber condition")
//       .sort({ issueDate: -1 })

//     // Get borrower's borrowing history
//     const borrowingHistory = await Borrowing.find({
//       email: borrowerEmail,
//     })
//       .populate("toyId", "name category image")
//       .populate("toyUnitId", "unitNumber condition")
//       .sort({ issueDate: -1 })
//       .limit(20)

//     if (borrowingHistory.length === 0) {
//       return res.status(404).json({
//         success: false,
//         error: "Borrower not found",
//       })
//     }

//     // Get borrower info from the most recent record
//     const borrowerInfo = {
//       borrowerName: borrowingHistory[0].borrowerName,
//       email: borrowingHistory[0].email,
//       phone: borrowingHistory[0].phone,
//       relationship: borrowingHistory[0].relationship,
//     }

//     // Calculate status for current borrowings
//     const currentBorrowingsWithStatus = currentBorrowings.map((borrowing) => {
//       const today = new Date()
//       const dueDate = new Date(borrowing.dueDate)
//       const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)

//       let status = "Active"
//       if (dueDate < today) {
//         status = "Overdue"
//       } else if (dueDate <= threeDaysFromNow) {
//         status = "Due Soon"
//       }

//       return { ...borrowing.toObject(), calculatedStatus: status }
//     })

//     // Calculate status for history
//     const historyWithStatus = borrowingHistory.map((borrowing) => {
//       if (borrowing.status === "Returned") {
//         const returnDate = new Date(borrowing.returnDate)
//         const dueDate = new Date(borrowing.dueDate)

//         if (returnDate <= dueDate) {
//           return { ...borrowing.toObject(), calculatedStatus: "Returned On Time" }
//         } else {
//           const daysLate = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24))
//           return { ...borrowing.toObject(), calculatedStatus: `Returned Late (${daysLate} Days)` }
//         }
//       }
//       return { ...borrowing.toObject(), calculatedStatus: borrowing.status }
//     })

//     res.json({
//       success: true,
//       data: {
//         borrowerInfo,
//         currentBorrowings: currentBorrowingsWithStatus,
//         borrowingHistory: historyWithStatus,
//         totalBorrowings: borrowingHistory.length,
//         activeBorrowings: currentBorrowings.length,
//       },
//     })
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     })
//   }
// })

// // POST /api/borrowers/:borrowerEmail/send-reminder - Send reminder to specific borrower
// app.post("/api/borrowers/:borrowerEmail/send-reminder", async (req, res) => {
//   try {
//     const { borrowerEmail } = req.params
//     const { borrowingId } = req.body

//     const borrowing = await Borrowing.findById(borrowingId)
//       .populate("toyId", "name")
//       .populate("toyUnitId", "unitNumber")

//     if (!borrowing) {
//       return res.status(404).json({
//         success: false,
//         error: "Borrowing not found",
//       })
//     }

//     if (borrowing.email !== borrowerEmail) {
//       return res.status(400).json({
//         success: false,
//         error: "Borrowing does not belong to this borrower",
//       })
//     }

//     // Here you would implement actual email sending
//     console.log(`Sending reminder to ${borrowing.email} for ${borrowing.toyId.name}`)

//     res.json({
//       success: true,
//       message: "Reminder sent successfully",
//     })
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     })
//   }
// })

// // GET /api/toys/:toyId/details - Get detailed toy information

// app.get("/api/borrowerss/:borrowerId", async (req, res) => {
//   try {
//     const { borrowerId } = req.params;

//     console.log(borrowerId)

//     // Get the specific borrowing record
//     const mainBorrowing = await Borrowing.findById(borrowerId)
//       .populate("toyId")
//       .populate("toyUnitId");

//     if (!mainBorrowing) {
//       return res.status(404).json({
//         success: false,
//         error: "Borrowing record not found",
//       });
//     }

//     const borrowerEmail = mainBorrowing.email;

//     // Get all borrowings for this borrower
//     const allBorrowings = await Borrowing.find({
//       email: borrowerEmail,
//     })
//       .populate("toyId")
//       .populate("toyUnitId")
//       .sort({ issueDate: -1 });

//     // Clean the data to avoid object rendering issues
//     const cleanBorrowings = allBorrowings.map((borrowing) => {
//       const today = new Date();
//       const dueDate = new Date(borrowing.dueDate);
//       let calculatedStatus = "Active";

//       if (borrowing.returnDate) {
//         const returnDate = new Date(borrowing.returnDate);
//         calculatedStatus = returnDate <= dueDate ? "Returned On Time" : "Returned Late";
//       } else if (dueDate < today) {
//         calculatedStatus = "Overdue";
//       } else if (dueDate <= new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)) {
//         calculatedStatus = "Due Soon";
//       }

//       return {
//         _id: String(borrowing._id),
//         toyName: borrowing.toyId ? String(borrowing.toyId.name) : "Unknown Toy",
//         toyCategory: borrowing.toyId ? String(borrowing.toyId.category) : "Unknown",
//         toyImage: borrowing.toyId && borrowing.toyId.image ? String(borrowing.toyId.image) : null,
//         unitNumber: borrowing.toyUnitId ? Number(borrowing.toyUnitId.unitNumber) : 0,
//         unitCondition: borrowing.toyUnitId ? String(borrowing.toyUnitId.condition) : "Unknown",
//         issueDate: String(borrowing.issueDate),
//         dueDate: String(borrowing.dueDate),
//         returnDate: borrowing.returnDate ? String(borrowing.returnDate) : null,
//         status: String(borrowing.status),
//         calculatedStatus: String(calculatedStatus),
//         notes: borrowing.notes ? String(borrowing.notes) : null,
//       };
//     });

//     const currentBorrowings = cleanBorrowings.filter((b) => !b.returnDate);

//     const response = {
//       success: true,
//       data: {
//         borrowerInfo: {
//           borrowerName: String(mainBorrowing.borrowerName),
//           email: String(mainBorrowing.email),
//           phone: String(mainBorrowing.phone),
//           relationship: String(mainBorrowing.relationship),
//         },
//         currentBorrowings: currentBorrowings,
//         borrowingHistory: cleanBorrowings,
//         totalBorrowings: Number(allBorrowings.length),
//         activeBorrowings: Number(currentBorrowings.length),
//       },
//     };

//     res.json(response);
//   } catch (error) {
//     console.error("Error fetching borrower details:", error);
//     res.status(500).json({
//       success: false,
//       error: "Server Error",
//     });
//   }
// });

// app.post("/api/borrowers/:borrowerId/send-reminder", async (req, res) => {
//   try {
//     const { borrowerId } = req.params;
//     console.log(`Sending reminder for borrowing ID: ${borrowerId}`);

//     res.json({
//       success: true,
//       message: "Reminder sent successfully",
//     });
//   } catch (error) {
//     console.error("Error sending reminder:", error);
//     res.status(500).json({
//       success: false,
//       error: "Server Error",
//     });
//   }
// });
