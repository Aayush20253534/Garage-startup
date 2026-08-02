const { Resend } = require("resend");

const DEFAULT_NOTIFICATION_RECIPIENT = "rovauto.official@gmail.com";

let resendClient = null;
let activeResendApiKey = null;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getResendClient = () => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();

  if (!apiKey) {
    const error = new Error("RESEND_API_KEY is missing");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  if (!resendClient || activeResendApiKey !== apiKey) {
    resendClient = new Resend(apiKey);
    activeResendApiKey = apiKey;
  }

  return resendClient;
};

const getSender = () =>
  String(process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "").trim();

const getRecipient = () =>
  String(
    process.env.NEW_USER_NOTIFICATION_EMAIL || DEFAULT_NOTIFICATION_RECIPIENT,
  )
    .trim()
    .toLowerCase();

const sendNewUserSignupNotification = async ({ user, signupMethod }) => {
  const sender = getSender();
  const recipient = getRecipient();

  if (!sender) {
    const error = new Error("EMAIL_FROM or RESEND_FROM_EMAIL is missing");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const registeredAt = user.createdAt ? new Date(user.createdAt) : new Date();
  const registeredAtText = Number.isNaN(registeredAt.getTime())
    ? new Date().toISOString()
    : registeredAt.toISOString();
  const details = {
    userId: String(user.id || "Not available"),
    name: String(user.name || "Not provided"),
    email: String(user.email || "Not provided"),
    phone: String(user.phone || "Not provided"),
    signupMethod: String(signupMethod || user.authProvider || "UNKNOWN"),
    registeredAt: registeredAtText,
  };

  const text = [
    "A new customer has signed up on Rovauto.",
    "",
    `Name: ${details.name}`,
    `Email: ${details.email}`,
    `Phone: ${details.phone}`,
    `Signup method: ${details.signupMethod}`,
    `User ID: ${details.userId}`,
    `Registered at: ${details.registeredAt}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 8px;">New Rovauto customer signup</h2>
      <p style="margin-top: 0; color: #4b5563;">
        A new customer has successfully created a Rovauto account.
      </p>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tr><td style="padding: 8px; font-weight: 700; border-bottom: 1px solid #e5e7eb;">Name</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(details.name)}</td></tr>
        <tr><td style="padding: 8px; font-weight: 700; border-bottom: 1px solid #e5e7eb;">Email</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(details.email)}</td></tr>
        <tr><td style="padding: 8px; font-weight: 700; border-bottom: 1px solid #e5e7eb;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(details.phone)}</td></tr>
        <tr><td style="padding: 8px; font-weight: 700; border-bottom: 1px solid #e5e7eb;">Signup method</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(details.signupMethod)}</td></tr>
        <tr><td style="padding: 8px; font-weight: 700; border-bottom: 1px solid #e5e7eb;">User ID</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(details.userId)}</td></tr>
        <tr><td style="padding: 8px; font-weight: 700;">Registered at</td><td style="padding: 8px;">${escapeHtml(details.registeredAt)}</td></tr>
      </table>
    </div>
  `;

  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: sender,
    to: [recipient],
    subject: "New Rovauto customer signup",
    html,
    text,
    tags: [
      {
        name: "type",
        value: "new-user-signup",
      },
    ],
  });

  if (error) {
    throw new Error(error.message || "Email provider rejected the signup notification");
  }

  if (!data?.id) {
    throw new Error("Email provider did not confirm the signup notification");
  }

  return {
    sent: true,
    emailId: data.id,
  };
};

module.exports = {
  DEFAULT_NOTIFICATION_RECIPIENT,
  sendNewUserSignupNotification,
};
