const { Resend } = require("resend");

let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getGarageEmailSender = () =>
  String(process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "").trim();

const sendGarageApplicationEmail = async ({ to, subject, message }) => {
  const recipient = String(to || "").trim().toLowerCase();
  const sender = getGarageEmailSender();

  if (!recipient) {
    throw new Error("Garage application email recipient is missing");
  }

  if (!resend || !sender) {
    const error = new Error("Garage application email delivery is not configured");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const html = `
    <h2>${escapeHtml(subject)}</h2>
    <p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>
    <p>Team Rovauto</p>
  `;

  const result = await resend.emails.send({
    from: sender,
    to: recipient,
    subject,
    html,
  });

  if (result?.error) {
    throw new Error(result.error.message || "Email provider rejected the message");
  }

  return {
    sent: true,
    providerId: result?.data?.id || null,
  };
};

module.exports = {
  getGarageEmailSender,
  sendGarageApplicationEmail,
};
