const { Resend } = require("resend");

const DEFAULT_ADMIN_EMAIL = "rovauto.official@gmail.com";

let resendClient = null;
let activeApiKey = null;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getClient = () => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("RESEND_API_KEY is missing");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  if (!resendClient || activeApiKey !== apiKey) {
    resendClient = new Resend(apiKey);
    activeApiKey = apiKey;
  }

  return resendClient;
};

const getSender = () =>
  String(process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "").trim();

const getAdminEmail = () =>
  String(process.env.FIRST_BOOKING_VERIFICATION_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)
    .trim()
    .toLowerCase();

const sendEmail = async ({ to, subject, text, html, tag }) => {
  const recipient = String(to || "").trim().toLowerCase();
  const sender = getSender();

  if (!recipient) throw new Error("Verification email recipient is missing");
  if (!sender) {
    const error = new Error("EMAIL_FROM or RESEND_FROM_EMAIL is missing");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const { data, error } = await getClient().emails.send({
    from: sender,
    to: [recipient],
    subject,
    text,
    html,
    tags: tag ? [{ name: "type", value: tag }] : undefined,
  });

  if (error) throw new Error(error.message || "Email provider rejected the message");
  if (!data?.id) throw new Error("Email provider did not confirm delivery");

  return { sent: true, providerId: data.id, recipient };
};

const formatLeadDetails = (lead) => ({
  bookingCode: lead.booking?.bookingCode || lead.bookingId,
  customerName: lead.user?.name || "Customer",
  customerEmail: lead.user?.email || "Not provided",
  customerPhone: lead.user?.phone || "Not provided",
  vehicle: [lead.booking?.vehicle?.brand, lead.booking?.vehicle?.model]
    .filter(Boolean)
    .join(" ") || "Not provided",
  estimate: Number(lead.booking?.totalServiceMaxAmount || 0),
  address: lead.booking?.customerAddress || "Not provided",
});

const buildLeadEmail = ({ lead, heading, intro, supportUrl }) => {
  const details = formatLeadDetails(lead);
  const text = [
    heading,
    "",
    intro,
    "",
    `Booking: ${details.bookingCode}`,
    `Customer: ${details.customerName}`,
    `Phone: ${details.customerPhone}`,
    `Email: ${details.customerEmail}`,
    `Vehicle: ${details.vehicle}`,
    `Maximum estimate: ₹${details.estimate}`,
    `Address: ${details.address}`,
    supportUrl ? `Open lead: ${supportUrl}` : null,
  ].filter(Boolean).join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:680px">
      <h2 style="margin-bottom:8px">${escapeHtml(heading)}</h2>
      <p style="margin-top:0;color:#4b5563">${escapeHtml(intro)}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        ${[
          ["Booking", details.bookingCode],
          ["Customer", details.customerName],
          ["Phone", details.customerPhone],
          ["Email", details.customerEmail],
          ["Vehicle", details.vehicle],
          ["Maximum estimate", `₹${details.estimate}`],
          ["Address", details.address],
        ].map(([label, value]) => `<tr><td style="padding:8px;font-weight:700;border-bottom:1px solid #e5e7eb">${escapeHtml(label)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(value)}</td></tr>`).join("")}
      </table>
      ${supportUrl ? `<p style="margin-top:20px"><a href="${escapeHtml(supportUrl)}" style="display:inline-block;padding:11px 18px;border-radius:10px;background:#111827;color:white;text-decoration:none;font-weight:700">Open verification lead</a></p>` : ""}
    </div>`;

  return { text, html };
};

const sendNewLeadEmail = async ({ to, lead, supportUrl }) => {
  const content = buildLeadEmail({
    lead,
    heading: "New first-booking verification lead",
    intro: "A customer received the first-booking platform-fee waiver and is waiting for verification. Claim the lead before calling.",
    supportUrl,
  });
  return sendEmail({
    to,
    subject: `Verification needed: ${lead.booking?.bookingCode || "new booking"}`,
    ...content,
    tag: "first-booking-lead",
  });
};

const sendUnclaimedEscalationEmail = async ({ lead, supportUrl }) => {
  const content = buildLeadEmail({
    lead,
    heading: "First-booking lead unclaimed for two minutes",
    intro: "No support account claimed this lead within two minutes. Please check support availability and contact the customer.",
    supportUrl,
  });
  return sendEmail({
    to: getAdminEmail(),
    subject: `Unclaimed verification lead: ${lead.booking?.bookingCode || lead.id}`,
    ...content,
    tag: "first-booking-lead-escalation",
  });
};

const sendSuspiciousLeadEmail = async ({ lead, supportAgent }) => {
  const content = buildLeadEmail({
    lead,
    heading: "First-booking lead rejected as suspicious",
    intro: `${supportAgent?.name || "A support agent"} rejected this customer verification lead as suspicious. Review the booking and notes in the admin/support records.`,
  });
  return sendEmail({
    to: getAdminEmail(),
    subject: `Suspicious booking rejected: ${lead.booking?.bookingCode || lead.id}`,
    ...content,
    tag: "first-booking-lead-rejected",
  });
};

module.exports = {
  DEFAULT_ADMIN_EMAIL,
  sendNewLeadEmail,
  sendSuspiciousLeadEmail,
  sendUnclaimedEscalationEmail,
};
