//Appointment confirmation email template

exports.appointmentConfirmation = ({
  name,
  service,
  date,
  startTime,
  endTime,
  therapist,
  consultationMode,
}) => `
  <h2>Appointment Confirmation</h2>
  <p>Hello ${name},</p>

  <p>Your appointment has been successfully scheduled. Here are the details:</p>

  <ul>
    <li><strong>Service:</strong> ${service}</li>
    <li><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</li>
    <li><strong>Time:</strong> ${startTime} - ${endTime}</li>
    <li><strong>Therapist:</strong> ${therapist}</li>
    <li><strong>Consultation Mode:</strong> ${consultationMode}</li>
  </ul>

  <p>We look forward to seeing you.</p>
  <p>Thanks,<br/>The 8 Senses Team</p>
`;
