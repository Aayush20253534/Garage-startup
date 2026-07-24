const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("price range moderation supports sub-admin review while deletion stays main-admin-only", () => {
  const routes = read(
    "server/src/admin/routes/cityServicePriceRange.routes.js",
  );
  const controller = read(
    "server/src/admin/controllers/cityServicePriceRange.controller.js",
  );
  const revenue = read("client/src/pages/admin/Revenue.jsx");
  const api = read("client/src/api/admin.js");
  const schema = read("server/prisma/schema.prisma");

  assert.match(routes, /router\.get\(\s*"\/submissions"/);
  assert.match(
    routes,
    /router\.patch\([\s\S]*?"\/submissions\/:id\/review"[\s\S]*?authorizeRoles\("ADMIN", "SUB_ADMIN"\)/,
  );
  assert.match(
    routes,
    /router\.post\([\s\S]*?"\/submissions\/approve-all"[\s\S]*?authorizeRoles\("ADMIN", "SUB_ADMIN"\)/,
  );
  assert.match(
    routes,
    /router\.delete\([\s\S]*?"\/submissions\/:id"[\s\S]*?authorizeRoles\("ADMIN"\)/,
  );
  assert.match(
    routes,
    /router\.delete\([\s\S]*?"\/submissions"[\s\S]*?authorizeRoles\("ADMIN"\)[\s\S]*?deletePriceRangeSubmissions/,
  );
  assert.match(
    routes,
    /router\.patch\([\s\S]*?"\/submissions\/:id"[\s\S]*?authorizeRoles\("ADMIN", "SUB_ADMIN"\)[\s\S]*?editPriceRangeSubmission/,
  );
  assert.match(controller, /req\.user\.role === "INTERN"/);
  assert.match(controller, /createPriceRangeSubmission\(req\.body, req\.user\)/);
  assert.match(revenue, /Intern Price Range Review/);
  assert.match(revenue, /My Price Range Submissions/);
  assert.match(revenue, /SubmissionStatusBadge/);
  assert.match(revenue, /visibleSubmissions\.length > 2/);
  assert.match(revenue, /overflow-y-auto/);
  assert.match(revenue, /deleteSubmissionHistory/);
  assert.match(revenue, /Delete submission history/);
  assert.match(revenue, /Save as edited/);
  assert.match(revenue, /setSubmissionFilter\("EDITED"\)/);
  assert.match(revenue, /Approve all \(\$\{submissionCounts\.PENDING \+ submissionCounts\.EDITED\}\)/);
  assert.match(revenue, /approveAllPriceRangeSubmissions/);
  assert.match(revenue, /filterVehicleBrand/);
  assert.match(revenue, /filterVehicleModel/);
  assert.match(revenue, /filterFuelType/);
  assert.match(revenue, /vehicleBrand: filterVehicleBrand/);
  assert.match(revenue, /vehicleModel: filterVehicleModel/);
  assert.match(revenue, /fuelType: filterFuelType/);
  assert.match(revenue, /All brands/);
  assert.match(revenue, /All models/);
  assert.match(revenue, /All fuel types/);
  assert.match(revenue, /deleteAllSubmissionHistory/);
  assert.match(revenue, /Delete all \(\$\{visibleSubmissions\.length\}\)/);
  assert.match(api, /async deletePriceRangeSubmissions\(status = null\)/);
  assert.match(api, /editPriceRangeSubmission/);
  assert.match(api, /async approveAllPriceRangeSubmissions\(\)/);
  assert.match(schema, /enum PriceRangeSubmissionStatus \{[\s\S]*EDITED/);

  const service = read(
    "server/src/admin/services/cityServicePriceRange.service.js",
  );
  assert.match(service, /priceRangeSubmission\.deleteMany/);
  assert.match(service, /approvedPriceRangeId/);
  assert.match(service, /const approveAllPriceRangeSubmissions/);
  assert.match(service, /processed: approved \+ superseded/);
  assert.match(service, /const deletePriceRangeSubmissions/);
  assert.match(service, /where: normalizedStatus \? \{ status: normalizedStatus \} : \{\}/);
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
    if (
      typeof where.status === "string" &&
      submission.status !== where.status
    ) {
      return false;
    }
    if (where.status?.in && !where.status.in.includes(submission.status)) {
      return false;
    }
    if (
      where.submittedById &&
      submission.submittedById !== where.submittedById
    ) {
      return false;
    }
    for (const field of [
      "city",
      "serviceId",
      "vehicleBrand",
      "vehicleModel",
      "fuelType",
    ]) {
      if (
        Object.prototype.hasOwnProperty.call(where, field) &&
        submission[field] !== where[field]
      ) {
        return false;
      }
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
    async deleteMany({ where }) {
      if (where.status) {
        let count = 0;
        for (const [id, submission] of submissions) {
          if (submission.status !== where.status) continue;
          submissions.delete(id);
          count += 1;
        }
        return { count };
      }

      const approvedIds = Array.isArray(where.approvedPriceRangeId?.in)
        ? where.approvedPriceRangeId.in
        : [where.approvedPriceRangeId].filter(Boolean);
      let count = 0;

      for (const [id, submission] of submissions) {
        if (!approvedIds.includes(submission.approvedPriceRangeId)) continue;
        submissions.delete(id);
        count += 1;
      }

      return { count };
    },
    async delete({ where }) {
      const submission = submissions.get(where.id);
      submissions.delete(where.id);
      return submission;
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
      async upsert({ where, create, update }) {
        const index = liveRanges.findIndex((range) => range.scopeKey === where.scopeKey);
        if (index >= 0) {
          liveRanges[index] = { ...liveRanges[index], ...update };
          return liveRanges[index];
        }
        const range = { id: `range-${liveRanges.length + 1}`, ...create };
        liveRanges.push(range);
        return range;
      },
      async findMany({ where = {} } = {}) {
        if (where.id?.in) {
          return liveRanges.filter((range) => where.id.in.includes(range.id));
        }
        return [];
      },
      async findUnique({ where }) {
        return liveRanges.find((range) => range.id === where.id) || null;
      },
      async create({ data }) {
        const range = { id: `range-${liveRanges.length + 1}`, ...data };
        liveRanges.push(range);
        return range;
      },
      async update() {
        throw new Error("Unexpected live range update");
      },
      async delete({ where }) {
        const index = liveRanges.findIndex((range) => range.id === where.id);
        return liveRanges.splice(index, 1)[0];
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

    await assert.rejects(
      service.editPriceRangeSubmission(
        pending.id,
        { ...payload, minPrice: 1100, maxPrice: 1600 },
        { id: "intern-1", role: "INTERN" },
      ),
      /Only admins can edit/,
    );

    const edited = await service.editPriceRangeSubmission(
      pending.id,
      { ...payload, minPrice: 1100, maxPrice: 1600 },
      { id: "admin-1", role: "ADMIN" },
    );
    assert.equal(edited.status, "EDITED");
    assert.equal(edited.minPrice, 1100);
    assert.equal(edited.maxPrice, 1600);
    assert.equal(liveRanges.length, 0);

    const approved = await service.reviewPriceRangeSubmission(
      pending.id,
      { decision: "APPROVED" },
      { id: "admin-1", role: "ADMIN" },
    );
    assert.equal(approved.status, "APPROVED");
    assert.equal(liveRanges.length, 1);
    assert.equal(approved.approvedPriceRangeId, liveRanges[0].id);

    await service.deletePriceRange(approved.approvedPriceRangeId);
    assert.equal(liveRanges.length, 0);

    const historyAfterLiveDelete = await service.listPriceRangeSubmissions(
      {},
      { id: "intern-1", role: "INTERN" },
    );
    assert.equal(
      historyAfterLiveDelete.some((submission) => submission.id === pending.id),
      false,
    );

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
    assert.equal(liveRanges.length, 0);

    await assert.rejects(
      service.deletePriceRangeSubmission(rejected.id, {
        id: "intern-1",
        role: "INTERN",
      }),
      /Only admins can delete/,
    );
    await service.deletePriceRangeSubmission(rejected.id, {
      id: "admin-1",
      role: "ADMIN",
    });

    const historyAfterAdminDelete = await service.listPriceRangeSubmissions(
      {},
      { id: "intern-1", role: "INTERN" },
    );
    assert.equal(
      historyAfterAdminDelete.some(
        (submission) => submission.id === rejected.id,
      ),
      false,
    );

    await service.createPriceRangeSubmission(
      { ...payload, vehicleModel: "Civic" },
      { id: "intern-1", role: "INTERN" },
    );
    await service.createPriceRangeSubmission(
      { ...payload, vehicleModel: "Accord" },
      { id: "intern-1", role: "INTERN" },
    );

    const bulkResult = await service.approveAllPriceRangeSubmissions({
      id: "admin-1",
      role: "ADMIN",
    });
    assert.deepEqual(bulkResult, {
      approved: 2,
      superseded: 0,
      processed: 2,
    });
    assert.equal(liveRanges.length, 2);

    const deletedApproved = await service.deletePriceRangeSubmissions(
      { status: "APPROVED" },
      { id: "admin-1", role: "ADMIN" },
    );
    assert.deepEqual(deletedApproved, {
      deleted: 2,
      status: "APPROVED",
    });
    assert.equal(liveRanges.length, 2);

    await assert.rejects(
      service.approveAllPriceRangeSubmissions({
        id: "intern-1",
        role: "INTERN",
      }),
      /Only admins can approve/,
    );
  } finally {
    if (previousPrisma) require.cache[prismaPath] = previousPrisma;
    else delete require.cache[prismaPath];
    if (previousCache) require.cache[cachePath] = previousCache;
    else delete require.cache[cachePath];
    if (previousService) require.cache[servicePath] = previousService;
    else delete require.cache[servicePath];
  }
});
