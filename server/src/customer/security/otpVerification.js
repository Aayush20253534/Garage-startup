const crypto = require("crypto");

const ApiError = require("../../utils/apiError");
const hashOtp = require("../../utils/hashOtp");

const OTP_MAX_ATTEMPTS = 5;
const OTP_CONCURRENCY_RETRIES = 8;

const safeHashEquals = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const invalidOtpResult = (statusCode = 400) => ({
  ok: false,
  statusCode,
  message:
    statusCode === 429
      ? "Maximum OTP verification attempts exceeded. Request a new OTP."
      : "Invalid or expired OTP",
});

const throwOtpResult = (result) => {
  if (result?.ok) return result;

  throw new ApiError(
    result?.statusCode || 400,
    result?.message || "Invalid or expired OTP",
  );
};

/**
 * Atomically consumes a persistent user OTP using optimistic compare-and-set.
 * The caller may pass a Prisma transaction client so OTP consumption and the
 * protected action commit or roll back together.
 */
const consumeAccountOtp = async ({
  client,
  model,
  identityField,
  identityId,
  purpose,
  otp,
}) => {
  const otpModel = client?.[model];
  if (!otpModel) {
    throw new Error("OTP consumption requires a Prisma client or transaction");
  }

  const submittedOtp = String(otp || "").trim();

  if (!/^\d{6}$/.test(submittedOtp)) {
    return invalidOtpResult();
  }

  const submittedHash = hashOtp(submittedOtp);

  for (let retry = 0; retry < OTP_CONCURRENCY_RETRIES; retry += 1) {
    const record = await otpModel.findUnique({
      where: {
        [`${identityField}_purpose`]: {
          [identityField]: identityId,
          purpose,
        },
      },
    });

    if (!record || record.usedAt) return invalidOtpResult();

    const now = new Date();
    if (record.expiresAt <= now) {
      await otpModel.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: now },
      });
      return invalidOtpResult();
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await otpModel.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: now },
      });
      return invalidOtpResult(429);
    }

    if (!safeHashEquals(record.otpHash, submittedHash)) {
      const nextAttempts = record.attempts + 1;
      const attempted = await otpModel.updateMany({
        where: {
          id: record.id,
          attempts: record.attempts,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          attempts: nextAttempts,
          ...(nextAttempts >= OTP_MAX_ATTEMPTS && { usedAt: now }),
        },
      });

      if (attempted.count !== 1) continue;

      return invalidOtpResult(
        nextAttempts >= OTP_MAX_ATTEMPTS ? 429 : 400,
      );
    }

    const consumedAt = new Date();
    const consumed = await otpModel.updateMany({
      where: {
        id: record.id,
        otpHash: record.otpHash,
        attempts: record.attempts,
        usedAt: null,
        expiresAt: { gt: consumedAt },
      },
      data: { usedAt: consumedAt },
    });

    if (consumed.count === 1) {
      return { ok: true, record, consumedAt };
    }
  }

  return {
    ok: false,
    statusCode: 409,
    message: "OTP verification is already in progress. Please retry.",
  };
};

const consumeUserOtp = ({ client, userId, purpose, otp }) =>
  consumeAccountOtp({
    client,
    model: "otp",
    identityField: "userId",
    identityId: userId,
    purpose,
    otp,
  });

const consumeGarageOwnerOtp = ({
  client,
  garageOwnerId,
  purpose,
  otp,
}) =>
  consumeAccountOtp({
    client,
    model: "garageOwnerOtp",
    identityField: "garageOwnerId",
    identityId: garageOwnerId,
    purpose,
    otp,
  });

module.exports = {
  OTP_MAX_ATTEMPTS,
  OTP_CONCURRENCY_RETRIES,
  safeHashEquals,
  invalidOtpResult,
  throwOtpResult,
  consumeGarageOwnerOtp,
  consumeUserOtp,
};
