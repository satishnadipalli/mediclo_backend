const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
// Import routes
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const discountRoutes = require("./routes/discountRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const shippingRoutes = require("./routes/shippingRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const courseRoutes = require("./routes/courseRoutes");
const webinarRoutes = require("./routes/webinarRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

// Test API
app.get("/api/test", (req, res) => {
  res.status(200).json({ success: true, message: "API is working!" });
});



// Mount routers
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/patients", require("./routes/patientRoutes"));
app.use(
  "/api/therapists",
  require("./routes/therapistRoutes")
);
app.use("/api/services", require("./routes/serviceRoutes"));
app.use("/api/blogs", require("./routes/blogRoutes"));
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/jobs", require("./routes/jobRoutes"));
app.use(
  "/api/applications",
  require("./routes/jobApplicationRoutes")
);
app.use("/api/courses", courseRoutes);
app.use("/api/webinars", webinarRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

// Comment out or remove routes that don't exist yet
// app.use("/api/appointments", require("./routes/appointmentRoutes"));
// app.use("/api/memberships", require("./routes/membershipRoutes"));
// app.use("/api/toys", require("./routes/toyRoutes"));
// app.use("/api/testimonials", require("./routes/testimonialRoutes"));

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to 8Senses Pediatric Therapy API" });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle errors when the port is busy
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});



