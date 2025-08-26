const axios = require("axios");
const Appointment = require("../models/Appointment");

const HELTAR_API_KEY = process.env.HELTAR_API_KEY;

// helper to format Indian numbers
function formatPhoneNumber(number) {
  if (!number) return null;

  let cleaned = number.toString().replace(/\D/g, ""); // remove non-digits

  // remove leading 0 if present
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // ensure starts with 91
  if (!cleaned.startsWith("91")) {
    cleaned = "91" + cleaned;
  }

  return cleaned; // no + (heltar expects without plus in clientWaNumber)
}

async function sendAppointmentReminder(appointmentId) {
  try {
    // ✅ populate serviceId to get service name
    const appointment = await Appointment.findById(appointmentId).populate(
      "serviceId",
      "name"
    );
    if (!appointment) {
      console.log("⚠️ Appointment not found");
      return;
    }

    const rawNumber = appointment.phone;
    if (!rawNumber) {
      console.log(`⚠️ No phone number for appointment ${appointment._id}`);
      return;
    }

    const recipient = formatPhoneNumber(rawNumber);

    console.log("📤 Sending reminder to:", recipient);

    await axios.post(
      "https://api.heltar.com/v1/messages/send",
      {
        messages: [
          {
            clientWaNumber: recipient,
            templateName: "8sensesmessage",
            templateContent:
              "Dear Parent,\n\nYour appointment for {{1}} has been fixed at {{2}} on {{3}}.\nKindly confirm your availability.",
            languageCode: "en",
            variables: [
              {
                type: "body",
                parameters: [
                  {
                    type: "text",
                    text: appointment.serviceId?.name || "Therapy",
                  },
                  { type: "text", text: appointment.formattedDate },
                  { type: "text", text: appointment.startTime },
                ],
              },
            ],
            messageType: "template",
          },
        ],
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
