const { Resend } = require("resend");
const ApiError = require("../../utils/apiError");

let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const sendContactMessage = async ({ name, email, message }) => {
  if (!process.env.RESEND_API_KEY) {
    throw new ApiError(500, "Resend API key missing");
  }

  const safeName = escapeHtml(String(name || "").trim().slice(0, 120));
  const safeEmail = escapeHtml(String(email || "").trim().slice(0, 254));
  const safeMessage = escapeHtml(String(message || "").trim().slice(0, 3000));
  const subjectName = String(name || "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 80);

  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Rovauto <onboarding@resend.dev>",
    to: process.env.CONTACT_INBOX || "rovauto.offical@gmail.com",
    replyTo: email,
    subject: `New Rovauto Contact Message from ${subjectName}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>New Contact Message</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage.replace(/\n/g, "<br/>")}</p>
      </div>
    `,
  });

  if (result.error) {
    throw new ApiError(500, result.error.message || "Failed to send message");
  }

  return {
    sent: true,
  };
};

module.exports = {
  sendContactMessage,
};
