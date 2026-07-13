const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const createKeyedConcurrencyLimit = require("../../src/middlewares/keyedConcurrencyLimit.middleware");
const upload = require("../../src/middlewares/upload.middleware");

const runValidation = (req) =>
  new Promise((resolve) => {
    upload.validateUploadedFiles(req, {}, resolve);
  });

class ResponseStub extends EventEmitter {
  constructor() {
    super();
    this.headers = new Map();
  }

  setHeader(name, value) {
    this.headers.set(name, value);
  }
}

test("complaint upload signature validation reads disk-backed files", async () => {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "complaint-upload-test-"),
  );
  const filePath = path.join(tempDir, "upload");

  try {
    await fs.promises.writeFile(
      filePath,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    const req = {
      files: [{ path: filePath, mimetype: "image/png" }],
    };

    assert.equal(await runValidation(req), undefined);
    await upload.cleanupUploadedTempFiles(req);
    await assert.rejects(fs.promises.access(filePath), { code: "ENOENT" });
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
});

test("complaint upload signature validation rejects spoofed disk files", async () => {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "complaint-upload-test-"),
  );
  const filePath = path.join(tempDir, "upload");

  try {
    await fs.promises.writeFile(filePath, "not an image");

    const req = {
      files: [{ path: filePath, mimetype: "image/png" }],
    };
    const error = await runValidation(req);

    assert.equal(error.statusCode, 400);
    assert.match(error.message, /does not match/i);
    await upload.cleanupUploadedTempFiles(req);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
});

test("complaint concurrency limit rejects overlapping work and releases slots", () => {
  const middleware = createKeyedConcurrencyLimit({
    name: "complaint upload",
    maxGlobal: 2,
    maxPerKey: 1,
    keyGenerator: (req) => req.user.id,
  });
  const firstResponse = new ResponseStub();
  let firstError;

  middleware({ user: { id: "customer-1" } }, firstResponse, (error) => {
    firstError = error;
  });
  assert.equal(firstError, undefined);

  const blockedResponse = new ResponseStub();
  let blockedError;
  middleware({ user: { id: "customer-1" } }, blockedResponse, (error) => {
    blockedError = error;
  });

  assert.equal(blockedError.statusCode, 429);
  assert.equal(blockedError.code, "CONCURRENCY_LIMITED");
  assert.equal(blockedResponse.headers.get("Retry-After"), "5");

  firstResponse.emit("finish");

  const retryResponse = new ResponseStub();
  let retryError;
  middleware({ user: { id: "customer-1" } }, retryResponse, (error) => {
    retryError = error;
  });
  assert.equal(retryError, undefined);
  retryResponse.emit("finish");
});

test("complaint creation rolls back Cloudinary uploads when the database fails", async () => {
  const prisma = require("../../src/config/prisma");
  const cloudinaryUpload = require("../../src/utils/cloudinaryUpload");
  const complaintServicePath = require.resolve(
    "../../src/customer/services/complaint.service",
  );
  const originalCreate = prisma.complaint.create;
  const originalUpload = cloudinaryUpload.uploadToCloudinary;
  const originalDelete = cloudinaryUpload.deleteFromCloudinary;
  const uploadedSources = [];
  const deletedPublicIds = [];

  try {
    prisma.complaint.create = async () => {
      throw new Error("database unavailable");
    };
    cloudinaryUpload.uploadToCloudinary = async (source) => {
      uploadedSources.push(source);
      const number = uploadedSources.length;
      return {
        secure_url: `https://example.test/image-${number}`,
        public_id: `complaint-${number}`,
      };
    };
    cloudinaryUpload.deleteFromCloudinary = async (publicId) => {
      deletedPublicIds.push(publicId);
    };

    delete require.cache[complaintServicePath];
    const complaintService = require(complaintServicePath);

    await assert.rejects(
      complaintService.createComplaint(
        "customer-1",
        { title: "Test", description: "Test complaint" },
        [
          { path: "/tmp/complaint-1", mimetype: "image/png", size: 100 },
          { path: "/tmp/complaint-2", mimetype: "image/png", size: 100 },
        ],
      ),
      /database unavailable/,
    );

    assert.deepEqual(uploadedSources, [
      "/tmp/complaint-1",
      "/tmp/complaint-2",
    ]);
    assert.deepEqual(deletedPublicIds.sort(), [
      "complaint-1",
      "complaint-2",
    ]);
  } finally {
    prisma.complaint.create = originalCreate;
    cloudinaryUpload.uploadToCloudinary = originalUpload;
    cloudinaryUpload.deleteFromCloudinary = originalDelete;
    delete require.cache[complaintServicePath];
  }
});

test("complaint route keeps disk, size, rate, concurrency, and cleanup guards", async () => {
  const routeSource = await fs.promises.readFile(
    path.join(
      __dirname,
      "../../src/customer/routes/complaint.routes.js",
    ),
    "utf8",
  );

  assert.match(routeSource, /createDiskUpload/);
  assert.match(routeSource, /COMPLAINT_MAX_FILE_SIZE_BYTES/);
  assert.match(routeSource, /complaintCreateRateLimit/);
  assert.match(routeSource, /complaintCreateConcurrencyLimit/);
  assert.match(routeSource, /registerUploadCleanup/);
});
