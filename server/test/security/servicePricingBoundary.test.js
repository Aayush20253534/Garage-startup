const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL ||=
  "postgresql://test:test@127.0.0.1:5432/rovauto_test";

const prismaPath = require.resolve("../../src/config/prisma");
const cachePath = require.resolve("../../src/utils/cache");
const cloudinaryPath = require.resolve("../../src/utils/cloudinaryUpload");
const priceRangeServicePath = require.resolve(
  "../../src/admin/services/cityServicePriceRange.service",
);

const serviceRecord = {
  id: "service-1",
  categoryId: "category-1",
  name: "Oil change",
  description: "Engine oil and filter replacement",
  basePrice: 800,
  minPrice: 700,
  maxPrice: 900,
  isActive: true,
  isComingSoon: false,
  media: [],
};

const calls = {
  creates: [],
  updates: [],
};

const prisma = {
  serviceCategory: {
    findUnique: async () => ({
      id: "category-1",
      name: "Maintenance",
      services: [],
    }),
    findMany: async () => [
      {
        id: "category-1",
        name: "Maintenance",
        isActive: true,
        services: [{ ...serviceRecord }],
      },
    ],
  },
  service: {
    create: async (args) => {
      calls.creates.push(args);
      return { id: "service-created", ...args.data, media: [] };
    },
    findUnique: async () => ({ ...serviceRecord }),
    update: async (args) => {
      calls.updates.push(args);
      return { ...serviceRecord, ...args.data };
    },
  },
};

require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prisma,
};
require.cache[cachePath] = {
  id: cachePath,
  filename: cachePath,
  loaded: true,
  exports: {
    deletePattern: async () => {},
    getCache: async () => null,
    setCache: async () => {},
  },
};
require.cache[cloudinaryPath] = {
  id: cloudinaryPath,
  filename: cloudinaryPath,
  loaded: true,
  exports: {
    deleteFromCloudinary: async () => {},
    uploadToCloudinary: async () => ({}),
  },
};
require.cache[priceRangeServicePath] = {
  id: priceRangeServicePath,
  filename: priceRangeServicePath,
  loaded: true,
  exports: {
    findBestPriceRangesForBooking: async () => new Map(),
  },
};

const adminService = require("../../src/admin/services/serviceAdmin.service");
const publicService = require("../../src/customer/services/service.service");

test("admin creates a service without service-level prices", async () => {
  calls.creates.length = 0;

  await adminService.createService({
    categoryId: "category-1",
    name: "Oil change",
    description: "Engine oil and filter replacement",
    isActive: true,
    isComingSoon: false,
  });

  assert.equal(calls.creates.length, 1);
  assert.deepEqual(calls.creates[0].data, {
    categoryId: "category-1",
    name: "Oil change",
    description: "Engine oil and filter replacement",
    isActive: true,
    isComingSoon: false,
  });
});

test("stale admin clients cannot update legacy service price columns", async () => {
  calls.updates.length = 0;

  await adminService.updateService("service-1", {
    name: "Premium oil change",
    basePrice: 1200,
    minPrice: 1000,
    maxPrice: 1400,
  });

  assert.equal(calls.updates.length, 1);
  assert.deepEqual(calls.updates[0].data, {
    name: "Premium oil change",
  });
});

test("logged-out catalogue keeps active services while hiding legacy prices", async () => {
  const categories = await publicService.getServiceCategories({});
  const [service] = categories[0].services;

  assert.equal(service.id, serviceRecord.id);
  assert.equal(service.name, serviceRecord.name);
  assert.equal(service.hasPrice, false);
  assert.equal("basePrice" in service, false);
  assert.equal("minPrice" in service, false);
  assert.equal("maxPrice" in service, false);
});
