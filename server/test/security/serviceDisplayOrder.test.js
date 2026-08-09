const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("services have a persistent per-category display order", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260809050000_add_service_display_order/migration.sql",
  );

  assert.match(schema, /displayOrder\s+Int\s+@default\(0\)/);
  assert.match(schema, /@@index\(\[categoryId, displayOrder\]\)/);
  assert.match(migration, /PARTITION BY "categoryId"/);
  assert.match(migration, /Service_categoryId_displayOrder_idx/);
});

test("admin can persist the complete service order for one category", () => {
  const routes = read("server/src/admin/routes/serviceAdmin.routes.js");
  const service = read("server/src/admin/services/serviceAdmin.service.js");
  const clientApi = read("client/src/api/admin.js");
  const adminPage = read("client/src/pages/admin/Services.jsx");

  assert.match(routes, /categories\/:categoryId\/service-order/);
  assert.match(service, /const reorderCategoryServices = async/);
  assert.match(service, /data: \{ displayOrder: index \+ 1 \}/);
  assert.match(service, /The services in this category changed/);
  assert.match(clientApi, /reorderCategoryServices\(categoryId, serviceIds\)/);
  assert.match(adminPage, /moveCategoryService/);
  assert.match(adminPage, /Move service up/);
  assert.match(adminPage, /Move service down/);
});

test("customer catalogue respects admin service ordering", () => {
  const customerService = read("server/src/customer/services/service.service.js");
  const adminService = read("server/src/admin/services/serviceAdmin.service.js");

  assert.match(customerService, /\{ displayOrder: "asc" \}/);
  assert.match(adminService, /\{ displayOrder: "asc" \}/);
});
