const crypto = require("crypto");

const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const generateOtp = require("../../utils/generateOtp");
const hashOtp = require("../../utils/hashOtp");
const { sendEmailOtp } = require("./otp.service");

const {
  STAFF_OTP_EXPIRY_MS,
  STAFF_OTP_MAX_ATTEMPTS,
  STAFF_OTP_RESEND_COOLDOWN_MS,
  resolveDeliveryEmail,
} = require("../security/staffTwoFactorRules");

const safeHashEquals = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const createChallenge = async ({ accountId, accountType, role, email }) => {
  const deliveryEmail = resolveDeliveryEmail({ role, email });
  const otp = generateOtp();

  const now = new Date();
  const challenge = await prisma.staffLoginChallenge.upsert({
    where: {
      accountId_accountType: { accountId, accountType },
    },
    update: {
      role,
      deliveryEmail,
      otpHash: hashOtp(otp),
      attempts: 0,
      consumedAt: null,
      expiresAt: new Date(now.getTime() + STAFF_OTP_EXPIRY_MS),
      createdAt: now,
    },
    create: {
      accountId,
      accountType,
      role,
      deliveryEmail,
      otpHash: hashOtp(otp),
      expiresAt: new Date(now.getTime() + STAFF_OTP_EXPIRY_MS),
    },
  });

  try {
    await sendEmailOtp({
      to: deliveryEmail,
      otp,
      subject: `Rovauto ${role.toLowerCase().replaceAll("_", " ")} login code`,
    });
  } catch (error) {
    await prisma.staffLoginChallenge
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

  return {
    requiresTwoFactor: true,
    challengeId: challenge.id,
    expiresInSeconds: Math.floor(STAFF_OTP_EXPIRY_MS / 1000),
  };
};

const verifyChallenge = async ({ challengeId, otp }) => {
  const submittedOtp = String(otp || "").trim();
  if (!/^\d{6}$/.test(submittedOtp)) {
    throw new ApiError(400, "OTP must be 6 digits");
  }

  const submittedHash = hashOtp(submittedOtp);

  for (let retry = 0; retry < 8; retry += 1) {
    const challenge = await prisma.staffLoginChallenge.findUnique({
      where: { id: challengeId },
    });

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date()
    ) {
      throw new ApiError(400, "Invalid or expired login challenge");
    }

    if (challenge.attempts >= STAFF_OTP_MAX_ATTEMPTS) {
      await prisma.staffLoginChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      throw new ApiError(
        429,
        "Maximum OTP verification attempts exceeded. Request a new OTP.",
      );
    }

    const now = new Date();

    if (!safeHashEquals(challenge.otpHash, submittedHash)) {
      const nextAttempts = challenge.attempts + 1;
      const attempted = await prisma.staffLoginChallenge.updateMany({
        where: {
          id: challenge.id,
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
        throw new ApiError(
          429,
          "Maximum OTP verification attempts exceeded. Request a new OTP.",
        );
      }

      throw new ApiError(400, "Invalid or expired OTP");
    }

    const consumed = await prisma.staffLoginChallenge.updateMany({
      where: {
        id: challenge.id,
        otpHash: challenge.otpHash,
        attempts: challenge.attempts,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });

    if (consumed.count === 1) return challenge;
  }

  throw new ApiError(
    409,
    "Login verification is already in progress. Please retry.",
  );
};

const resendChallenge = async (challengeId) => {
  const challenge = await prisma.staffLoginChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge || challenge.expiresAt <= new Date()) {
    throw new ApiError(400, "Invalid or expired login challenge");
  }

  if (challenge.consumedAt && challenge.attempts < STAFF_OTP_MAX_ATTEMPTS) {
    throw new ApiError(400, "Login challenge has already been used");
  }

  const resendAt =
    new Date(challenge.createdAt).getTime() +
    STAFF_OTP_RESEND_COOLDOWN_MS;

  if (Date.now() < resendAt) {
    const waitSeconds = Math.ceil((resendAt - Date.now()) / 1000);
    throw new ApiError(
      429,
      `Please wait ${waitSeconds}s before requesting another OTP`,
    );
  }

  return createChallenge({
    accountId: challenge.accountId,
    accountType: challenge.accountType,
    role: challenge.role,
    email: challenge.deliveryEmail,
  });
};

module.exports = {
  STAFF_OTP_EXPIRY_MS,
  STAFF_OTP_MAX_ATTEMPTS,
  STAFF_OTP_RESEND_COOLDOWN_MS,
  createChallenge,
  verifyChallenge,
  resendChallenge,
  resolveDeliveryEmail,
};
