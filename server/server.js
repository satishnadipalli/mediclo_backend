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
<<<<<<< HEAD
const startOverdueUpdateJob = require("./utils/cronJob");
const Toy = require("./models/Toy");
=======
const {
  startOverdueUpdateJob,
  startRenewalReminderJob,
} = require("./utils/cronJob");
>>>>>>> f582bd050f8c65eb02f5cf6f48cbe7f5f1e82583

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
const meetingRoutes = require("./routes/meetingRoutes")
const galleryRoutes = require("./routes/galleryRoutes");
const diseaseRoutes = require("./routes/diseaseRoutes");
//Add shipping-routes
const paymentRoutes = require("./routes/paymentRoutes");
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
startRenewalReminderJob();

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
app.use("/api/meetings", meetingRoutes)
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


// GET /api/toys/search-available - Search available toys for issuing
app.get("/api/search-available", async (req, res) => {
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

    console.log("working up to here");
    res.json({
      success: true,
      data: toys,
    })
  } catch (error) {
    console.log(error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
});
