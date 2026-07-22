const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("official mobile/PWA traffic keeps CSRF cookies first-party", () => {
  const baseUrl = read("client/src/api/baseUrl.js");
  const axiosClient = read("client/src/api/axios.js");

  assert.match(baseUrl, /isOfficialRovautoHost/);
  assert.match(baseUrl, /hostname === "rovauto\.com"/);
  assert.match(
    baseUrl,
    /!forceCrossOriginApi && isOfficialRovautoHost\(\)[\s\S]*?return "\/api\/v1"/,
  );
  assert.match(axiosClient, /let csrfTokenRequest = null/);
  assert.match(axiosClient, /if \(!csrfTokenRequest\)/);
  assert.match(axiosClient, /return csrfTokenRequest/);
});

test("intern forgot-password uses a dedicated bounded OTP challenge", () => {
  const schema = read("server/prisma/schema.prisma");
  const validation = read(
    "server/src/customer/validations/auth.validation.js",
  );
  const authService = read(
    "server/src/customer/services/auth.service.js",
  );
  const resetService = read(
    "server/src/customer/services/staffPasswordReset.service.js",
  );
  const internApi = read("client/src/api/intern.js");
  const login = read("client/src/pages/intern/Login.jsx");
  const forgotPage = read("client/src/pages/intern/ForgotPassword.jsx");
  const app = read("client/src/App.jsx");
  const appState = read("client/src/hooks/useApp.jsx");

  assert.match(schema, /model StaffPasswordResetChallenge/);
  assert.match(validation, /PASSWORD_RECOVERY_ROLES = \[\.\.\.USER_ROLES, "GARAGE_CONTROLLER", "INTERN"\]/);
  assert.match(authService, /staffPasswordResetService\.createChallenge/);
  assert.match(authService, /staffPasswordResetService\.consumeChallenge/);
  assert.match(authService, /prisma\.\$transaction\(async \(tx\)/);
  assert.match(resetService, /STAFF_OTP_MAX_ATTEMPTS/);
  assert.match(resetService, /crypto\.timingSafeEqual/);
  assert.match(resetService, /consumedAt: now/);
  assert.match(internApi, /role: "INTERN"/);
  assert.match(login, /forgotPasswordTo="\/intern\/forgot-password"/);
  assert.match(forgotPage, /internApi\.resetPassword/);
  assert.match(app, /path="\/intern\/forgot-password"/);
  assert.match(
    appState,
    /pathname === "\/intern\/forgot-password"/,
  );
});

test("intern reset OTP is single-use and counts failed attempts", async () => {
  const prismaPath = require.resolve("../../src/config/prisma");
  const otpServicePath = require.resolve(
    "../../src/customer/services/otp.service",
  );
  const resetServicePath = require.resolve(
    "../../src/customer/services/staffPasswordReset.service",
  );
  const previousPrisma = require.cache[prismaPath];
  const previousOtpService = require.cache[otpServicePath];
  const previousResetService = require.cache[resetServicePath];
  let challenge = null;
  let delivered = null;

  const updateMany = async ({ where, data }) => {
    if (
      !challenge ||
      challenge.id !== where.id ||
      challenge.otpHash !== where.otpHash ||
      challenge.attempts !== where.attempts ||
      challenge.consumedAt
    ) {
      return { count: 0 };
    }

    Object.assign(challenge, data);
    return { count: 1 };
  };

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      staffPasswordResetChallenge: {
        async upsert({ create }) {
          challenge = {
            id: "reset-challenge-1",
            attempts: 0,
            consumedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...create,
          };
          return { ...challenge };
        },
        async deleteMany() {
          challenge = null;
          return { count: 1 };
        },
        async findUnique() {
          return challenge ? { ...challenge } : null;
        },
        updateMany,
      },
    },
  };
  require.cache[otpServicePath] = {
    id: otpServicePath,
    filename: otpServicePath,
    loaded: true,
    exports: {
      async sendEmailOtp(payload) {
        delivered = payload;
      },
    },
  };
  delete require.cache[resetServicePath];

  try {
    const service = require(resetServicePath);

    await service.createChallenge({
      staffAccountId: "intern-1",
      role: "INTERN",
      email: "intern@rovauto.com",
    });

    assert.equal(delivered.to, "intern@rovauto.com");
    assert.match(delivered.otp, /^\d{6}$/);
    assert.equal(delivered.subject, "Rovauto intern password reset OTP");

    const wrongOtp = delivered.otp === "000000" ? "111111" : "000000";
    await assert.rejects(
      service.consumeChallenge({
        staffAccountId: "intern-1",
        otp: wrongOtp,
      }),
      /Invalid or expired OTP/,
    );
    assert.equal(challenge.attempts, 1);

    await service.consumeChallenge({
      staffAccountId: "intern-1",
      otp: delivered.otp,
    });
    assert.ok(challenge.consumedAt);

    await assert.rejects(
      service.consumeChallenge({
        staffAccountId: "intern-1",
        otp: delivered.otp,
      }),
      /Invalid or expired OTP/,
    );
  } finally {
    if (previousPrisma) require.cache[prismaPath] = previousPrisma;
    else delete require.cache[prismaPath];
    if (previousOtpService) require.cache[otpServicePath] = previousOtpService;
    else delete require.cache[otpServicePath];
    if (previousResetService) {
      require.cache[resetServicePath] = previousResetService;
    } else {
      delete require.cache[resetServicePath];
    }
  }
});

test("interns can create price ranges but cannot edit or delete them", () => {
  const routes = read(
    "server/src/admin/routes/cityServicePriceRange.routes.js",
  );
  const revenue = read("client/src/pages/admin/Revenue.jsx");

  const createRoute = routes.match(/router\.post\([\s\S]*?\n\);/)?.[0] || "";
  const updateRoute = routes.match(/router\.patch\([\s\S]*?\n\);/)?.[0] || "";
  const deleteRoute = routes.match(/router\.delete\([\s\S]*?\n\);/)?.[0] || "";

  assert.match(createRoute, /authorizeRoles\("ADMIN", "INTERN"\)/);
  assert.match(updateRoute, /authorizeRoles\("ADMIN"\)/);
  assert.doesNotMatch(updateRoute, /"INTERN"/);
  assert.match(deleteRoute, /authorizeRoles\("ADMIN"\)/);
  assert.doesNotMatch(deleteRoute, /"INTERN"/);
  assert.match(revenue, /Interns can add new price ranges/);
  assert.match(revenue, /Admin edit\/delete only/);
  assert.match(revenue, /if \(isIntern && form\.id\)/);
});
