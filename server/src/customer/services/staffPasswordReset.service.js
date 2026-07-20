const crypto = require("crypto");

const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const generateOtp = require("../../utils/generateOtp");
const hashOtp = require("../../utils/hashOtp");
const { sendEmailOtp } = require("./otp.service");
const {
  STAFF_OTP_EXPIRY_MS,
  STAFF_OTP_MAX_ATTEMPTS,
  resolveDeliveryEmail,
} = require("../security/staffTwoFactorRules");

const safeHashEquals = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const createChallenge = async ({ staffAccountId, role, email }) => {
  const deliveryEmail = resolveDeliveryEmail({ role, email });
  const otp = generateOtp();
  const now = new Date();
  const challenge = await prisma.staffPasswordResetChallenge.upsert({
    where: { staffAccountId },
    update: {
      otpHash: hashOtp(otp),
      attempts: 0,
      expiresAt: new Date(now.getTime() + STAFF_OTP_EXPIRY_MS),
      consumedAt: null,
      createdAt: now,
    },
    create: {
      staffAccountId,
      otpHash: hashOtp(otp),
      expiresAt: new Date(now.getTime() + STAFF_OTP_EXPIRY_MS),
    },
  });

  try {
    await sendEmailOtp({
      to: deliveryEmail,
      otp,
      subject: "Rovauto intern password reset OTP",
    });
  } catch (error) {
    await prisma.staffPasswordResetChallenge
      .deleteMany({
        where: {
          id: challenge.id,
          otpHash: challenge.otpHash,
          createdAt: challenge.createdAt,
        },
      })
      .catch(() => {});
    throw error;
  }
};

const consumeChallenge = async ({ client = prisma, staffAccountId, otp }) => {
  const submittedOtp = String(otp || "").trim();
  if (!/^\d{6}$/.test(submittedOtp)) {
    throw new ApiError(400, "OTP must be 6 digits");
  }

  const submittedHash = hashOtp(submittedOtp);

  for (let retry = 0; retry < 8; retry += 1) {
    const challenge = await client.staffPasswordResetChallenge.findUnique({
      where: { staffAccountId },
    });

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date()
    ) {
      throw new ApiError(400, "Invalid or expired OTP");
    }

    if (challenge.attempts >= STAFF_OTP_MAX_ATTEMPTS) {
      throw new ApiError(429, "Maximum OTP verification attempts exceeded");
    }

    const now = new Date();

    if (!safeHashEquals(challenge.otpHash, submittedHash)) {
      const nextAttempts = challenge.attempts + 1;
      const attempted = await client.staffPasswordResetChallenge.updateMany({
        where: {
          id: challenge.id,
          otpHash: challenge.otpHash,
          attempts: challenge.attempts,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          attempts: nextAttempts,
          ...(nextAttempts >= STAFF_OTP_MAX_ATTEMPTS && {
            consumedAt: now,
          }),
        },
      });

      if (attempted.count !== 1) continue;

      if (nextAttempts >= STAFF_OTP_MAX_ATTEMPTS) {
        throw new ApiError(429, "Maximum OTP verification attempts exceeded");
      }

      throw new ApiError(400, "Invalid or expired OTP");
    }

    const consumed = await client.staffPasswordResetChallenge.updateMany({
      where: {
        id: challenge.id,
        otpHash: challenge.otpHash,
        attempts: challenge.attempts,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });

    if (consumed.count === 1) return true;
  }

  throw new ApiError(
    409,
    "OTP verification is already in progress. Please retry.",
  );
};

module.exports = {
  createChallenge,
  consumeChallenge,
};
