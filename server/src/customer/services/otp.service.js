const { Resend } = require("resend");

const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const generateOtp = require("../../utils/generateOtp");
const hashOtp = require("../../utils/hashOtp");
const { normalizePhone } = require("../../utils/phone");
const {
  OTP_MAX_ATTEMPTS,
  OTP_CONCURRENCY_RETRIES,
  safeHashEquals,
  invalidOtpResult,
  throwOtpResult,
  consumeUserOtp,
} = require("../security/otpVerification");

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const GARAGE_EMAIL_OTP_EXPIRY_MS = 120 * 60 * 1000;
const DEFAULT_OTP_EXPIRY_TEXT = "5 minutes";
const GARAGE_EMAIL_OTP_EXPIRY_TEXT = "120 minutes (2 hours)";
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

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

const buildOtpEmail = ({
  otp,
  subject,
  expiryText = DEFAULT_OTP_EXPIRY_TEXT,
}) => {
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
              This OTP expires in ${expiryText}. Do not share it with anyone.
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
    `This OTP expires in ${expiryText}.`,
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
  expiryText = DEFAULT_OTP_EXPIRY_TEXT,
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
    expiryText,
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

  const now = new Date();
  const createdOtp = await prisma.emailOtp.upsert({
    where: { email: cleanEmail },
    update: {
      otpHash: hashOtp(otp),
      expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
      attempts: 0,
      createdAt: now,
    },
    create: {
      email: cleanEmail,
      otpHash: hashOtp(otp),
      expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
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
      .deleteMany({
        where: {
          id: createdOtp.id,
          otpHash: createdOtp.otpHash,
          createdAt: createdOtp.createdAt,
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

  const submittedHash = hashOtp(submittedOtp);

  for (let retry = 0; retry < OTP_CONCURRENCY_RETRIES; retry += 1) {
    const record = await prisma[model].findUnique({
      where: { [identifierField]: identifier },
    });

    if (!record) {
      throwOtpResult(invalidOtpResult());
    }

    const now = new Date();

    if (record.expiresAt <= now) {
      await prisma[model].deleteMany({ where: { id: record.id } });
      throwOtpResult(invalidOtpResult());
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma[model].deleteMany({ where: { id: record.id } });
      throwOtpResult(invalidOtpResult(429));
    }

    if (!safeHashEquals(record.otpHash, submittedHash)) {
      const nextAttempts = record.attempts + 1;
      const attempted = await prisma[model].updateMany({
        where: {
          id: record.id,
          attempts: record.attempts,
          expiresAt: { gt: now },
        },
        data: { attempts: nextAttempts },
      });

      if (attempted.count !== 1) continue;

      if (nextAttempts >= OTP_MAX_ATTEMPTS) {
        await prisma[model].deleteMany({
          where: { id: record.id, attempts: nextAttempts },
        });
        throwOtpResult(invalidOtpResult(429));
      }

      throwOtpResult(invalidOtpResult());
    }

    const consumed = await prisma[model].deleteMany({
      where: {
        id: record.id,
        otpHash: record.otpHash,
        attempts: record.attempts,
        expiresAt: { gt: now },
      },
    });

    if (consumed.count === 1) return true;
  }

  throw new ApiError(409, "OTP verification is already in progress. Please retry.");
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

const verifySignupOtp = async ({ email, otp }) =>
  verifyEmailOtp({ email, otp });

const createResetPasswordOtp = async (
  userId,
  email,
  {
    expiryMs = OTP_EXPIRY_MS,
    expiryText = DEFAULT_OTP_EXPIRY_TEXT,
    subject = "Rovauto password reset OTP",
  } = {},
) => {
  const otp = generateOtp();
  const cleanEmail = normalizeEmail(email);

  const now = new Date();
  const createdOtp = await prisma.otp.upsert({
    where: {
      userId_purpose: { userId, purpose: "RESET_PASSWORD" },
    },
    update: {
      otpHash: hashOtp(otp),
      expiresAt: new Date(now.getTime() + expiryMs),
      usedAt: null,
      attempts: 0,
      createdAt: now,
    },
    create: {
      userId,
      otpHash: hashOtp(otp),
      purpose: "RESET_PASSWORD",
      expiresAt: new Date(now.getTime() + expiryMs),
    },
  });

  try {
    await sendEmailOtp({
      to: cleanEmail,
      otp,
      subject,
      expiryText,
    });
  } catch (error) {
    await prisma.otp
      .deleteMany({
        where: {
          id: createdOtp.id,
          otpHash: createdOtp.otpHash,
          createdAt: createdOtp.createdAt,
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

const createGarageResetPasswordOtp = async (userId, email) =>
  createResetPasswordOtp(userId, email, {
    expiryMs: GARAGE_EMAIL_OTP_EXPIRY_MS,
    expiryText: GARAGE_EMAIL_OTP_EXPIRY_TEXT,
    subject: "Rovauto garage password reset OTP",
  });

const createDeleteAccountOtp = async (userId, email) => {
  const otp = generateOtp();
  const cleanEmail = normalizeEmail(email);

  const now = new Date();
  const createdOtp = await prisma.otp.upsert({
    where: {
      userId_purpose: { userId, purpose: "DELETE_ACCOUNT" },
    },
    update: {
      otpHash: hashOtp(otp),
      expiresAt: new Date(now.getTime() + GARAGE_EMAIL_OTP_EXPIRY_MS),
      usedAt: null,
      attempts: 0,
      createdAt: now,
    },
    create: {
      userId,
      otpHash: hashOtp(otp),
      purpose: "DELETE_ACCOUNT",
      expiresAt: new Date(now.getTime() + GARAGE_EMAIL_OTP_EXPIRY_MS),
    },
  });

  try {
    await sendEmailOtp({
      to: cleanEmail,
      otp,
      subject: "Confirm Rovauto garage account deletion",
      expiryText: GARAGE_EMAIL_OTP_EXPIRY_TEXT,
    });
  } catch (error) {
    await prisma.otp
      .deleteMany({
        where: {
          id: createdOtp.id,
          otpHash: createdOtp.otpHash,
          createdAt: createdOtp.createdAt,
        },
      })
      .catch(() => {});
    throw error;
  }

  return { email: cleanEmail };
};

const verifyDeleteAccountOtp = async (userId, otp) => {
  const result = await consumeUserOtp({
    client: prisma,
    userId,
    purpose: "DELETE_ACCOUNT",
    otp,
  });

  throwOtpResult(result);
  return true;
};

module.exports = {
  OTP_MAX_ATTEMPTS,
  GARAGE_EMAIL_OTP_EXPIRY_MS,
  createSignupOtp,
  createPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp,
  verifySignupOtp,
  createResetPasswordOtp,
  createGarageResetPasswordOtp,
  createDeleteAccountOtp,
  verifyDeleteAccountOtp,
  consumeUserOtp,
  throwOtpResult,
  sendEmailOtp,
};