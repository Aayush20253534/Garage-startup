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
  maskEmail,
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

  await prisma.staffLoginChallenge.deleteMany({
    where: { accountId, accountType },
  });

  const challenge = await prisma.staffLoginChallenge.create({
    data: {
      accountId,
      accountType,
      role,
      deliveryEmail,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + STAFF_OTP_EXPIRY_MS),
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
      .delete({ where: { id: challenge.id } })
      .catch(() => {});
    throw error;
  }

  return {
    requiresTwoFactor: true,
    challengeId: challenge.id,
    maskedEmail: maskEmail(deliveryEmail),
    expiresInSeconds: Math.floor(STAFF_OTP_EXPIRY_MS / 1000),
  };
};

const getUsableChallenge = async (challengeId) => {
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
    await prisma.staffLoginChallenge.delete({
      where: { id: challenge.id },
    }).catch(() => {});
    throw new ApiError(429, "Maximum OTP verification attempts exceeded");
  }

  return challenge;
};

const verifyChallenge = async ({ challengeId, otp }) => {
  const submittedOtp = String(otp || "").trim();
  if (!/^\d{6}$/.test(submittedOtp)) {
    throw new ApiError(400, "OTP must be 6 digits");
  }

  const challenge = await getUsableChallenge(challengeId);
  const submittedHash = hashOtp(submittedOtp);

  if (!safeHashEquals(challenge.otpHash, submittedHash)) {
    await prisma.staffLoginChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new ApiError(400, "Invalid or expired OTP");
  }

  const consumed = await prisma.staffLoginChallenge.updateMany({
    where: {
      id: challenge.id,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  });

  if (consumed.count !== 1) {
    throw new ApiError(400, "Invalid or expired login challenge");
  }

  return challenge;
};

const resendChallenge = async (challengeId) => {
  const challenge = await getUsableChallenge(challengeId);
  const resendAt = new Date(challenge.createdAt).getTime() + STAFF_OTP_RESEND_COOLDOWN_MS;

  if (Date.now() < resendAt) {
    const waitSeconds = Math.ceil((resendAt - Date.now()) / 1000);
    throw new ApiError(429, `Please wait ${waitSeconds}s before requesting another OTP`);
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
  maskEmail,
};
