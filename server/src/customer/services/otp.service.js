const { Resend } = require("resend");

const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const generateOtp = require("../../utils/generateOtp");
const hashOtp = require("../../utils/hashOtp");
const { normalizePhone } = require("../../utils/phone");

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

let resendClient = null;
let activeResendApiKey = null;

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();

const getEmailSender = () =>
  String(
    process.env.EMAIL_FROM ||
      process.env.RESEND_FROM_EMAIL ||
      "",
  ).trim();

const getResendClient = () => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();

  if (!apiKey) {
    throw new ApiError(
      500,
      "Email service is not configured. RESEND_API_KEY is missing.",
    );
  }

  if (!resendClient || activeResendApiKey !== apiKey) {
    resendClient = new Resend(apiKey);
    activeResendApiKey = apiKey;
  }

  return resendClient;
};

const assertOtpCooldown = (latestOtp) => {
  if (!latestOtp) return;

  const resendAt =
    new Date(latestOtp.createdAt).getTime() + OTP_RESEND_COOLDOWN_MS;

  if (Date.now() < resendAt) {
    const waitSeconds = Math.ceil((resendAt - Date.now()) / 1000);

    throw new ApiError(
      429,
      `Please wait ${waitSeconds}s before requesting another OTP`,
    );
  }
};

const buildOtpEmail = ({ otp, subject }) => {
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>

      <body
        style="
          margin: 0;
          padding: 0;
          background: #f5f6f8;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
        "
      >
        <div style="max-width: 560px; margin: 40px auto; padding: 20px">
          <div
            style="
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 18px;
              padding: 32px;
            "
          >
            <h1 style="margin: 0 0 12px; font-size: 25px">
              ${subject}
            </h1>

            <p
              style="
                margin: 0 0 24px;
                color: #6b7280;
                font-size: 15px;
                line-height: 1.6;
              "
            >
              Use the verification code below to continue with Rovauto.
            </p>

            <div
              style="
                padding: 20px;
                border-radius: 14px;
                background: #f3f4f6;
                text-align: center;
                font-size: 38px;
                font-weight: 700;
                letter-spacing: 10px;
              "
            >
              ${otp}
            </div>

            <p
              style="
                margin: 24px 0 0;
                color: #6b7280;
                font-size: 14px;
                line-height: 1.6;
              "
            >
              This OTP expires in 5 minutes. Do not share it with anyone.
            </p>

            <p
              style="
                margin: 20px 0 0;
                color: #9ca3af;
                font-size: 12px;
              "
            >
              If you did not request this code, you can safely ignore this
              email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = [
    subject,
    "",
    `Your Rovauto OTP is: ${otp}`,
    "",
    "This OTP expires in 5 minutes.",
    "Do not share this OTP with anyone.",
  ].join("\n");

  return {
    html,
    text,
  };
};

const sendEmailOtp = async ({
  to,
  otp,
  subject = "Verify your Rovauto account",
}) => {
  const cleanEmail = normalizeEmail(to);
  const deliveryMode = String(
    process.env.EMAIL_OTP_DELIVERY || "",
  )
    .trim()
    .toLowerCase();

  if (!cleanEmail) {
    throw new ApiError(400, "Recipient email is required");
  }

  if (deliveryMode !== "email") {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(
        500,
        "Email OTP delivery is disabled. Set EMAIL_OTP_DELIVERY=email.",
      );
    }

    console.log("=================================");
    console.log("ROVAUTO DEVELOPMENT OTP");
    console.log("To:", cleanEmail);
    console.log("OTP:", otp);
    console.log("=================================");

    return {
      sent: false,
      mode: "development-log",
    };
  }

  const sender = getEmailSender();

  if (!sender) {
    throw new ApiError(
      500,
      "Email sender is missing. Set EMAIL_FROM or RESEND_FROM_EMAIL.",
    );
  }

  const { html, text } = buildOtpEmail({
    otp,
    subject,
  });

  try {
    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: sender,
      to: [cleanEmail],
      subject,
      html,
      text,
      tags: [
        {
          name: "type",
          value: "otp",
        },
      ],
    });

    if (error) {
      console.error("[Resend] OTP email rejected:", {
        recipient: cleanEmail,
        error,
      });

      throw new ApiError(
        502,
        error.message || "Resend rejected the OTP email.",
      );
    }

    if (!data?.id) {
      throw new ApiError(
        502,
        "Resend did not confirm that the OTP email was accepted.",
      );
    }

    console.log("[Resend] OTP email accepted:", {
      recipient: cleanEmail,
      emailId: data.id,
    });

    return {
      sent: true,
      emailId: data.id,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error("[Resend] OTP email failed:", {
      recipient: cleanEmail,
      message: error.message,
    });

    throw new ApiError(
      502,
      error.message || "Unable to send OTP email.",
    );
  }
};

const createEmailOtp = async ({
  email,
  otp,
  skipCooldown = false,
}) => {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    throw new ApiError(400, "Email is required");
  }

  const latestOtp = await prisma.emailOtp.findFirst({
    where: {
      email: cleanEmail,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!skipCooldown) {
    assertOtpCooldown(latestOtp);
  }

  await prisma.emailOtp.deleteMany({
    where: {
      email: cleanEmail,
    },
  });

  const createdOtp = await prisma.emailOtp.create({
    data: {
      email: cleanEmail,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });

  try {
    await sendEmailOtp({
      to: cleanEmail,
      otp,
      subject: "Verify your Rovauto account",
    });
  } catch (error) {
    /*
     * Delete the unusable OTP when email delivery fails.
     * This lets the customer request another OTP immediately.
     */
    await prisma.emailOtp
      .delete({
        where: {
          id: createdOtp.id,
        },
      })
      .catch(() => {});

    throw error;
  }

  return cleanEmail;
};

const createPhoneOtp = async () => {
  throw new ApiError(503, "SMS OTP is temporarily disabled");
};

const createSignupOtp = async ({
  email,
  skipCooldown = false,
}) => {
  const otp = generateOtp();

  const cleanEmail = await createEmailOtp({
    email,
    otp,
    skipCooldown,
  });

  return {
    email: cleanEmail,
  };
};

const verifyStoredOtp = async ({
  model,
  identifierField,
  identifier,
  otp,
}) => {
  const submittedOtp = String(otp || "").trim();

  if (!/^\d{6}$/.test(submittedOtp)) {
    throw new ApiError(400, "OTP must be 6 digits");
  }

  const record = await prisma[model].findFirst({
    where: {
      [identifierField]: identifier,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!record) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  if (record.expiresAt <= new Date()) {
    await prisma[model].delete({
      where: {
        id: record.id,
      },
    });

    throw new ApiError(400, "Invalid or expired OTP");
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma[model].delete({
      where: {
        id: record.id,
      },
    });

    throw new ApiError(
      429,
      "Maximum OTP verification attempts exceeded",
    );
  }

  if (record.otpHash !== hashOtp(submittedOtp)) {
    await prisma[model].update({
      where: {
        id: record.id,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    throw new ApiError(400, "Invalid or expired OTP");
  }

  await prisma[model].delete({
    where: {
      id: record.id,
    },
  });

  return true;
};

const verifyEmailOtp = async ({ email, otp }) => {
  return verifyStoredOtp({
    model: "emailOtp",
    identifierField: "email",
    identifier: normalizeEmail(email),
    otp,
  });
};

const verifyPhoneOtp = async ({ phone, otp }) => {
  return verifyStoredOtp({
    model: "phoneOtp",
    identifierField: "phone",
    identifier: normalizePhone(phone),
    otp,
  });
};

const getLatestOtpOrThrow = async ({
  model,
  identifierField,
  identifier,
}) => {
  const record = await prisma[model].findFirst({
    where: {
      [identifierField]: identifier,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!record) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  if (record.expiresAt <= new Date()) {
    await prisma[model].delete({
      where: {
        id: record.id,
      },
    });

    throw new ApiError(400, "Invalid or expired OTP");
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma[model].delete({
      where: {
        id: record.id,
      },
    });

    throw new ApiError(
      429,
      "Maximum OTP verification attempts exceeded",
    );
  }

  return record;
};

const verifySignupOtp = async ({ email, otp }) => {
  const cleanEmail = normalizeEmail(email);
  const submittedOtp = String(otp || "").trim();

  if (!/^\d{6}$/.test(submittedOtp)) {
    throw new ApiError(400, "OTP must be 6 digits");
  }

  const emailOtp = await getLatestOtpOrThrow({
    model: "emailOtp",
    identifierField: "email",
    identifier: cleanEmail,
  });

  if (emailOtp.otpHash !== hashOtp(submittedOtp)) {
    await prisma.emailOtp.update({
      where: {
        id: emailOtp.id,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    throw new ApiError(400, "Invalid or expired OTP");
  }

  await prisma.emailOtp.delete({
    where: {
      id: emailOtp.id,
    },
  });

  return true;
};

const createResetPasswordOtp = async (userId, email) => {
  const otp = generateOtp();
  const cleanEmail = normalizeEmail(email);

  await prisma.otp.deleteMany({
    where: {
      userId,
      purpose: "RESET_PASSWORD",
      usedAt: null,
    },
  });

  const createdOtp = await prisma.otp.create({
    data: {
      userId,
      otpHash: hashOtp(otp),
      purpose: "RESET_PASSWORD",
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });

  try {
    await sendEmailOtp({
      to: cleanEmail,
      otp,
      subject: "Rovauto password reset OTP",
    });
  } catch (error) {
    await prisma.otp
      .delete({
        where: {
          id: createdOtp.id,
        },
      })
      .catch(() => {});

    throw error;
  }

  /*
   * Kept for compatibility with your existing controller.
   * Do not expose this OTP in the production HTTP response.
   */
  return otp;
};

const createDeleteAccountOtp = async (userId, email) => {
  const otp = generateOtp();
  const cleanEmail = normalizeEmail(email);

  await prisma.otp.deleteMany({
    where: {
      userId,
      purpose: "DELETE_ACCOUNT",
      usedAt: null,
    },
  });

  const createdOtp = await prisma.otp.create({
    data: {
      userId,
      otpHash: hashOtp(otp),
      purpose: "DELETE_ACCOUNT",
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });

  try {
    await sendEmailOtp({
      to: cleanEmail,
      otp,
      subject: "Confirm Rovauto garage account deletion",
    });
  } catch (error) {
    await prisma.otp
      .delete({ where: { id: createdOtp.id } })
      .catch(() => {});
    throw error;
  }

  return { email: cleanEmail };
};

const verifyDeleteAccountOtp = async (userId, otp) => {
  const submittedOtp = String(otp || "").trim();

  if (!/^\d{6}$/.test(submittedOtp)) {
    throw new ApiError(400, "OTP must be 6 digits");
  }

  const record = await prisma.otp.findFirst({
    where: {
      userId,
      purpose: "DELETE_ACCOUNT",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otp.delete({ where: { id: record.id } }).catch(() => {});
    throw new ApiError(429, "Maximum OTP verification attempts exceeded");
  }

  if (record.otpHash !== hashOtp(submittedOtp)) {
    await prisma.otp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new ApiError(400, "Invalid or expired OTP");
  }

  const consumed = await prisma.otp.updateMany({
    where: {
      id: record.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });

  if (consumed.count !== 1) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  return true;
};

module.exports = {
  OTP_MAX_ATTEMPTS,
  createSignupOtp,
  createPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp,
  verifySignupOtp,
  createResetPasswordOtp,
  createDeleteAccountOtp,
  verifyDeleteAccountOtp,
  sendEmailOtp,
};