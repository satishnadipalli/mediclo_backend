const Razorpay = require("razorpay")
const crypto = require("crypto")
const SubscriptionPlan = require("../models/SubscriptionPlan")
const Order = require("../models/Order")
const Product = require("../models/Product")


// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})


exports.createSubscriptionPayment = async (req, res) => {
  try {
    console.log("💳 Creating payment order...")
    console.log("📝 Request body:", req.body)

    const { planId, name, email, phone } = req.body

    // Validate required fields
    if (!planId || !name || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: planId, name, email, phone",
      })
    }

    // Get plan details
    const plan = await SubscriptionPlan.findById(planId)
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: "Plan not found",
      })
    }

    // Create Razorpay order
    const orderOptions = {
      amount: plan.price * 100, // Amount in paise
      currency: "INR",
      receipt: `sub_${Date.now().toString().slice(-8)}_${req.user._id.toString().slice(-8)}`, // Keep it under 40 chars
      notes: {
        planId: plan._id.toString(),
        planName: plan.name,
        userId: req.user._id.toString(),
        userEmail: email,
        userName: name,
      },
    }

    console.log("📦 Creating Razorpay order with options:", orderOptions)

    const order = await razorpay.orders.create(orderOptions)
    console.log("✅ Razorpay order created:", order.id)

    // Return payment data with UPI and other payment methods enabled
    res.status(200).json({
      success: true,
      data: {
        key: process.env.RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "8 Senses",
        description: `${plan.name} Subscription`,
        order: {
          id: order.id,
          receipt: order.receipt,
        },
        prefill: {
          name,
          email,
          contact: phone,
        },
        // Enable all payment methods including UPI
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: false, // Set to true if you want EMI options
          paylater: false, // Set to true if you want pay later options
        },
        theme: {
          color: "#3399cc",
        },
        // Additional UPI configuration
        config: {
          display: {
            blocks: {
              utib: {
                name: "Pay using UPI",
                instruments: [
                  {
                    method: "upi",
                  },
                ],
              },
              other: {
                name: "Other Payment Methods",
                instruments: [
                  {
                    method: "card",
                  },
                  {
                    method: "netbanking",
                  },
                  {
                    method: "wallet",
                  },
                ],
              },
            },
            hide: [
              {
                method: "emi",
              },
            ],
            sequence: ["block.utib", "block.other"],
            preferences: {
              show_default_blocks: false,
            },
          },
        },
      },
    })
  } catch (error) {
    console.error("❌ Payment order creation error:", error)
    res.status(500).json({
      success: false,
      error: "Failed to create payment order",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}






exports.createProductPayment = async (req, res) => {
  try {
    console.log("💳 Creating product payment order...")
    console.log("📝 Request body:", req.body)

    const { orderId, name, email, phone } = req.body

    // Validate required fields
    if (!orderId || !name || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: orderId, name, email, phone",
      })
    }

    // Get order details - using _id since your system uses _id as reference
    const order = await Order.findById(orderId).populate("items.product")
    if (!order) {
      console.log("❌ Order not found with ID:", orderId)
      return res.status(404).json({
        success: false,
        error: "Order not found",
      })
    }

    console.log("✅ Order found:", order.orderNumber)

    // Use the total from your existing order system
    const totalAmount = order.total

    console.log("💰 Total amount from order:", totalAmount)

    // Create Razorpay order
    const orderOptions = {
      amount: Math.round(totalAmount * 100), // Amount in paise
      currency: "INR",
      receipt: `prod_${Date.now().toString().slice(-8)}_${orderId.toString().slice(-8)}`,
      notes: {
        orderId: orderId,
        orderNumber: order.orderNumber,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
      },
    }

    console.log("📦 Creating Razorpay order with options:", orderOptions)

    const razorpayOrder = await razorpay.orders.create(orderOptions)
    console.log("✅ Razorpay order created:", razorpayOrder.id)

    // Return payment data with UPI and other payment methods enabled
    res.status(200).json({
      success: true,
      data: {
        key: process.env.RAZORPAY_KEY_ID,
        amount: razorpayOrder.amount, // Already in paise
        currency: razorpayOrder.currency,
        name: "8 Senses Clinic",
        description: `Payment for Order #${order.orderNumber}`,
        order: {
          id: razorpayOrder.id,
          receipt: razorpayOrder.receipt,
        },
        prefill: {
          name,
          email,
          contact: phone,
        },
        // Enable all payment methods including UPI
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: false,
          paylater: false,
        },
        theme: {
          color: "#d83f96",
        },
        // Additional UPI configuration
        config: {
          display: {
            blocks: {
              utib: {
                name: "Pay using UPI",
                instruments: [
                  {
                    method: "upi",
                  },
                ],
              },
              other: {
                name: "Other Payment Methods",
                instruments: [
                  {
                    method: "card",
                  },
                  {
                    method: "netbanking",
                  },
                  {
                    method: "wallet",
                  },
                ],
              },
            },
            hide: [
              {
                method: "emi",
              },
            ],
            sequence: ["block.utib", "block.other"],
            preferences: {
              show_default_blocks: false,
            },
          },
        },
      },
    })
  } catch (error) {
    console.error("❌ Product payment order creation error:", error)
    res.status(500).json({
      success: false,
      error: "Failed to create payment order",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

/**
 * @desc    Verify product payment signature
 * @route   POST /api/payments/product/verify
 * @access  Public
 */
exports.verifyProductPayment = async (req, res) => {
  try {
    console.log("🔍 Verifying product payment...")
    console.log("📝 Request body:", req.body)

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return res.status(400).json({
        success: false,
        error: "Missing payment verification data",
      })
    }

    // Create signature for verification
    const body = razorpay_order_id + "|" + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex")

    // Verify signature
    if (expectedSignature !== razorpay_signature) {
      console.log("❌ Product payment signature verification failed")
      console.log("Expected:", expectedSignature)
      console.log("Received:", razorpay_signature)
      return res.status(400).json({
        success: false,
        error: "Payment verification failed",
      })
    }

    console.log("✅ Product payment signature verified")

    // Update order status using your existing order system
    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        paymentStatus: "paid",
        status: "processing", // Use your status system
        paymentDetails: {
          paymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          paymentMethod: "razorpay",
        },
        paidAt: new Date(),
      },
      { new: true },
    )

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      })
    }

    console.log("✅ Order updated successfully:", order.orderNumber)

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
        },
      },
    })
  } catch (error) {
    console.error("❌ Product payment verification error:", error)
    res.status(500).json({
      success: false,
      error: "Payment verification failed",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}
