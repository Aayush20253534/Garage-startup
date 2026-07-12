const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const schema = fs.readFileSync(
  path.join(projectRoot, "prisma/schema.prisma"),
  "utf8",
);
const otpService = fs.readFileSync(
  path.join(projectRoot, "src/customer/services/otp.service.js"),
  "utf8",
);
const staffService = fs.readFileSync(
  path.join(projectRoot, "src/customer/services/staffTwoFactor.service.js"),
  "utf8",
);
const otpVerificationSource = fs.readFileSync(
  path.join(projectRoot, "src/customer/security/otpVerification.js"),
  "utf8",
);
const lifecycleService = fs.readFileSync(
  path.join(projectRoot, "src/services/bookingLifecycle.service.js"),
  "utf8",
);

const count = (text, pattern) => (text.match(pattern) || []).length;

test("OTP records are unique per identity and purpose", () => {
  assert.match(schema, /model Otp[\s\S]*@@unique\(\[userId, purpose\]\)/);
  assert.match(schema, /model EmailOtp[\s\S]*@@unique\(\[email\]\)/);
  assert.match(schema, /model PhoneOtp[\s\S]*@@unique\(\[phone\]\)/);
});

test("authentication OTP success paths use compare-and-set consumption", () => {
  assert.ok(count(otpVerificationSource, /updateMany\(/g) >= 3);
  assert.match(otpVerificationSource, /usedAt: null/);
  assert.match(otpVerificationSource, /attempts: record\.attempts/);
  assert.match(otpService, /deleteMany\([\s\S]*otpHash: record\.otpHash/);
  assert.match(staffService, /consumedAt: null/);
  assert.match(staffService, /attempts: challenge\.attempts/);
});

test("the fifth invalid OTP attempt invalidates the code immediately", () => {
  assert.match(otpVerificationSource, /nextAttempts >= OTP_MAX_ATTEMPTS/);
  assert.match(otpVerificationSource, /usedAt: now/);
  assert.match(staffService, /nextAttempts >= STAFF_OTP_MAX_ATTEMPTS/);
});

test("handover OTP has attempt limits and an exclusive verification claim", () => {
  assert.match(schema, /handoverOtpAttempts\s+Int/);
  assert.match(schema, /handoverOtpClaimedAt\s+DateTime\?/);
  assert.match(lifecycleService, /HANDOVER_OTP_MAX_ATTEMPTS = 5/);
  assert.match(lifecycleService, /handoverOtpClaimedAt: claimedAt/);
  assert.match(lifecycleService, /handoverOtpHash: null/);
});

const hashOtp = require("../../src/utils/hashOtp");
const {
  consumeUserOtp,
  OTP_MAX_ATTEMPTS,
} = require("../../src/customer/security/otpVerification");

test("password-reset OTP is consumed with one compare-and-set update", async () => {
  const record = {
    id: "otp-1",
    userId: "user-1",
    purpose: "RESET_PASSWORD",
    otpHash: hashOtp("123456"),
    attempts: 0,
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };
  const updates = [];
  const client = {
    otp: {
      async findUnique() {
        return record;
      },
      async updateMany(args) {
        updates.push(args);
        return { count: 1 };
      },
    },
  };

  const result = await consumeUserOtp({
    client,
    userId: record.userId,
    purpose: record.purpose,
    otp: "123456",
  });

  assert.equal(result.ok, true);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].where.usedAt, null);
  assert.equal(updates[0].where.attempts, 0);
  assert.ok(updates[0].data.usedAt instanceof Date);
});

test("the fifth wrong password-reset OTP attempt consumes and locks the code", async () => {
  const record = {
    id: "otp-2",
    userId: "user-2",
    purpose: "RESET_PASSWORD",
    otpHash: hashOtp("123456"),
    attempts: OTP_MAX_ATTEMPTS - 1,
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };
  let updateArgs = null;
  const client = {
    otp: {
      async findUnique() {
        return record;
      },
      async updateMany(args) {
        updateArgs = args;
        return { count: 1 };
      },
    },
  };

  const result = await consumeUserOtp({
    client,
    userId: record.userId,
    purpose: record.purpose,
    otp: "654321",
  });

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 429);
  assert.equal(updateArgs.data.attempts, OTP_MAX_ATTEMPTS);
  assert.ok(updateArgs.data.usedAt instanceof Date);
});

test("a lost OTP compare-and-set race cannot report a second success", async () => {
  const available = {
    id: "otp-3",
    userId: "user-3",
    purpose: "RESET_PASSWORD",
    otpHash: hashOtp("123456"),
    attempts: 0,
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };
  let reads = 0;
  const client = {
    otp: {
      async findUnique() {
        reads += 1;
        return reads === 1
          ? available
          : { ...available, usedAt: new Date() };
      },
      async updateMany() {
        return { count: 0 };
      },
    },
  };

  const result = await consumeUserOtp({
    client,
    userId: available.userId,
    purpose: available.purpose,
    otp: "123456",
  });

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 400);
  assert.equal(reads, 2);
});
