const axios = require("axios");
const Appointment = require("../models/Appointment");

const HELTAR_API_KEY = process.env.HELTAR_API_KEY;
const HELTAR_NUMBER_ID = process.env.HELTAR_NUMBER_ID;

console.log(HELTAR_API_KEY, HELTAR_NUMBER_ID);
// helper to format Indian numbers
function formatPhoneNumber(number) {
  if (!number) return null;

  let cleaned = number.toString().replace(/\D/g, ""); // remove non-digits

  // remove leading 0 if present
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // ensure starts with +91
  if (!cleaned.startsWith("91")) {
    cleaned = "91" + cleaned;
  }

  return "+" + cleaned;
}

async function sendAppointmentReminder(appointment) {
  const rawNumber = appointment.fatherNumber || appointment.phone;
  if (!rawNumber) {
    console.log(`⚠️ No phone number found for appointment ${appointment._id}`);
    return;
  }

  const recipient = formatPhoneNumber(rawNumber);

  try {
    console.log("📤 Sending reminder to:", recipient);

    await axios.post(
      `https://graph.facebook.com/v17.0/${HELTAR_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: {
          body: `Hello ${appointment.patientName}, this is a reminder for your appointment on ${appointment.formattedDate} at ${appointment.startTime}.`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${HELTAR_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    appointment.remindersSent = (appointment.remindersSent || 0) + 1;
    appointment.lastReminderSent = new Date();
    await appointment.save();

    console.log(`✅ Reminder sent for appointment ${appointment._id}`);
  } catch (error) {
    console.error(
      "❌ Failed to send reminder:",
      error.response?.data || error.message
    );
  }
}

module.exports = { sendAppointmentReminder };
