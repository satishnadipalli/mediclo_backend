## Work done by Abhishek:

### Get Today's Appointments (Calendar Format with Fixed 45-Minute Time Slots)

- Endpoint: GET /api/appointments/calendar

- Access: Private (Admin, Receptionist, Therapist)

- Description: Retrieves today's appointments in a structured calendar view with predefined 45-minute slots.

### Reschedule an Appointment

- Endpoint: PUT /api/appointments/:id/reschedule

- Access: Private (Admin, Receptionist, Therapist)

- Description: Allows authorized users to reschedule an existing appointment by ID.
