const membershipReminder = (name, renewalDate) => `
    <h2>Hello ${name},</h2>
    <p>This is a friendly reminder that your membership is due for renewal on <strong>${renewalDate}</strong>.</p>
    <p>Please renew to continue enjoying our benefits.</p>
    <br/>
     <p>Thanks, <br/> The 8 Senses Team</p>
`;

module.exports = membershipReminder;
