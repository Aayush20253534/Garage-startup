const { Resend } = require("resend");

let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const sendGarageApplicationEmail = async ({ to, subject, message }) => {
  if (!to) return false;

  const html = `
      <h2>${subject}</h2>
      <p>${message}</p>
      <p>Team Rovauto</p>
    `;

  if (!resend || !process.env.EMAIL_FROM) {
    // Never print recipient data or message bodies here. Approval emails can
    // contain a temporary password and must not be copied into deployment logs.
    console.warn(
      "[garage-email] Email delivery is not configured; message was not sent.",
    );
    return false;
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });

  return true;
};

module.exports = {
  sendGarageApplicationEmail,
};
