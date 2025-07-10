//Email format for reschedule appointment

exports.appointmentReschedule = ({
  name,
  service,
  date,
  startTime,
  endTime,
  therapist,
  reason,
}) => `
  <h2>Appointment Rescheduled</h2>
  <p>Hello ${name},</p>

  <p>Your appointment has been successfully <strong>rescheduled</strong>. Here are the new details:</p>

  <ul>
    <li><strong>Service:</strong> ${service}</li>
    <li><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</li>
    <li><strong>Time:</strong> ${startTime} - ${endTime}</li>
    <li><strong>Therapist:</strong> ${therapist}</li>
  </ul>

  ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}

  <p>Let us know if you have any questions.</p>
  <p>Thanks,<br/>The 8 Senses Team</p>
`;
