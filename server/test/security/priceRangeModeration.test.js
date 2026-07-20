const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("price range moderation routes keep review admin-only", () => {
  const routes = read(
    "server/src/admin/routes/cityServicePriceRange.routes.js",
  );
  const controller = read(
    "server/src/admin/controllers/cityServicePriceRange.controller.js",
  );
  const revenue = read("client/src/pages/admin/Revenue.jsx");

  assert.match(routes, /router\.get\(\s*"\/submissions"/);
  assert.match(
    routes,
    /router\.patch\([\s\S]*?"\/submissions\/:id\/review"[\s\S]*?authorizeRoles\("ADMIN"\)/,
  );
  assert.match(controller, /req\.user\.role === "INTERN"/);
  assert.match(controller, /createPriceRangeSubmission\(req\.body, req\.user\)/);
  assert.match(revenue, /Intern Price Range Review/);
  assert.match(revenue, /My Price Range Submissions/);
  assert.match(revenue, /SubmissionStatusBadge/);
});

test("intern submissions stay outside live customer price ranges until approval", async () => {
  const prismaPath = require.resolve("../../src/config/prisma");
  const cachePath = require.resolve("../../src/utils/cache");
  const servicePath = require.resolve(
    "../../src/admin/services/cityServicePriceRange.service",
  );
  const previousPrisma = require.cache[prismaPath];
  const previousCache = require.cache[cachePath];
  const previousService = require.cache[servicePath];
  const submissions = new Map();
  const liveRanges = [];
  let nextSubmissionId = 1;

  const submissionInclude = (submission) => ({
    ...submission,
    service: { id: submission.serviceId, name: "AC Service", category: null },
    submittedBy: {
      id: submission.submittedById,
      name: "Test Intern",
      loginId: "intern-test",
    },
    reviewedBy: submission.reviewedById
      ? { id: submission.reviewedById, name: "Admin", loginId: "admin" }
      : null,
    approvedPriceRange: submission.approvedPriceRangeId
      ? { id: submission.approvedPriceRangeId, isActive: true }
      : null,
  });

  const matchesWhere = (submission, where = {}) => {
    if (where.id && typeof where.id === "string" && submission.id !== where.id) {
      return false;
    }
    if (where.id?.not && submission.id === where.id.not) return false;
    if (where.status && submission.status !== where.status) return false;
    if (
      where.submittedById &&
      submission.submittedById !== where.submittedById
    ) {
      return false;
    }
    return true;
  };

  const priceRangeSubmission = {
    async create({ data }) {
      const submission = {
        id: `submission-${nextSubmissionId++}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
        approvedPriceRangeId: null,
        ...data,
      };
      submissions.set(submission.id, submission);
      return submissionInclude(submission);
    },
    async findMany({ where }) {
      return [...submissions.values()]
        .filter((submission) => matchesWhere(submission, where))
        .map(submissionInclude);
    },
    async findUnique({ where }) {
      const submission = submissions.get(where.id);
      return submission ? { ...submission } : null;
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const submission of submissions.values()) {
        if (!matchesWhere(submission, where)) continue;
        Object.assign(submission, data, { updatedAt: new Date() });
        count += 1;
      }
      return { count };
    },
    async update({ where, data }) {
      const submission = submissions.get(where.id);
      Object.assign(submission, data, { updatedAt: new Date() });
      return submissionInclude(submission);
    },
  };

  const prismaMock = {
    service: {
      async findUnique({ where }) {
        return { id: where.id, name: "AC Service" };
      },
    },
    priceRangeSubmission,
    cityServicePriceRange: {
      async findMany() {
        return [];
      },
      async create({ data }) {
        const range = { id: `range-${liveRanges.length + 1}`, ...data };
        liveRanges.push(range);
        return range;
      },
      async update() {
        throw new Error("Unexpected live range update");
      },
      async deleteMany() {
        return { count: 0 };
      },
    },
    async $transaction(callback) {
      return callback(prismaMock);
    },
  };

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaMock,
  };
  require.cache[cachePath] = {
    id: cachePath,
    filename: cachePath,
    loaded: true,
    exports: {
      async getCache() {
        return null;
      },
      async setCache() {},
      async deletePattern() {},
    },
  };
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    const payload = {
      city: "Prayagraj",
      serviceId: "service-1",
      vehicleBrand: "Honda",
      vehicleModel: "City",
      fuelType: "PETROL",
      minPrice: 1000,
      maxPrice: 1500,
      isActive: true,
    };

    const pending = await service.createPriceRangeSubmission(payload, {
      id: "intern-1",
      role: "INTERN",
    });
    assert.equal(pending.status, "PENDING");
    assert.equal(liveRanges.length, 0);

    const internView = await service.listPriceRangeSubmissions({}, {
      id: "intern-1",
      role: "INTERN",
    });
    const otherInternView = await service.listPriceRangeSubmissions({}, {
      id: "intern-2",
      role: "INTERN",
    });
    assert.equal(internView.length, 1);
    assert.equal(otherInternView.length, 0);

    const approved = await service.reviewPriceRangeSubmission(
      pending.id,
      { decision: "APPROVED" },
      { id: "admin-1", role: "ADMIN" },
    );
    assert.equal(approved.status, "APPROVED");
    assert.equal(liveRanges.length, 1);
    assert.equal(approved.approvedPriceRangeId, liveRanges[0].id);

    const rejectedPending = await service.createPriceRangeSubmission(
      { ...payload, vehicleModel: "Civic" },
      { id: "intern-1", role: "INTERN" },
    );
    const rejected = await service.reviewPriceRangeSubmission(
      rejectedPending.id,
      { decision: "REJECTED", rejectionReason: "Incorrect estimate" },
      { id: "admin-1", role: "ADMIN" },
    );
    assert.equal(rejected.status, "REJECTED");
    assert.equal(rejected.rejectionReason, "Incorrect estimate");
    assert.equal(liveRanges.length, 1);
  } finally {
    if (previousPrisma) require.cache[prismaPath] = previousPrisma;
    else delete require.cache[prismaPath];
    if (previousCache) require.cache[cachePath] = previousCache;
    else delete require.cache[cachePath];
    if (previousService) require.cache[servicePath] = previousService;
    else delete require.cache[servicePath];
  }
});
