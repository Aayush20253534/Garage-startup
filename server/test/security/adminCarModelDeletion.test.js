const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const readProjectFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("car model deletion is validated, available to admins and sub-admins, and permanent", () => {
  const routes = readProjectFile("server/src/admin/routes/carMeta.routes.js");
  const service = readProjectFile("server/src/admin/services/carMeta.service.js");

  assert.match(
    routes,
    /router\.delete\("\/models\/:modelId", authorizeRoles\("ADMIN", "SUB_ADMIN"\), modelIdSchema, validate, controller\.deleteModel\)/,
  );

  const deleteStart = service.indexOf("const deleteModel");
  const deleteSource = service.slice(deleteStart, service.indexOf("module.exports"));
  assert.match(deleteSource, /vehicleModel\.delete/);
  assert.match(deleteSource, /invalidateVehicleMetaCache\(\)/);
  assert.doesNotMatch(deleteSource, /isActive:\s*false/);
});

test("admin cars UI removes a deleted model without reloading the list", () => {
  const page = readProjectFile("client/src/pages/admin/Cars.jsx");
  const deleteStart = page.indexOf("const deleteModel");
  const deleteSource = page.slice(deleteStart, page.indexOf("return (", deleteStart));

  assert.match(deleteSource, /adminApi\.deleteCarModel\(model\.id\)/);
  assert.match(deleteSource, /setBrands/);
  assert.match(deleteSource, /item\.id !== model\.id/);
  assert.doesNotMatch(deleteSource, /await load\(\)/);
  assert.doesNotMatch(deleteSource, /window\.location\.reload/);
});

test("admin cars UI merges saved models without reloading the list", () => {
  const page = readProjectFile("client/src/pages/admin/Cars.jsx");
  const saveStart = page.indexOf("const saveModel");
  const saveSource = page.slice(saveStart, page.indexOf("const editModel", saveStart));

  assert.match(saveSource, /savedModel = await adminApi\.createCarModel/);
  assert.match(saveSource, /savedModel = await adminApi\.updateCarModel/);
  assert.match(saveSource, /setBrands/);
  assert.match(saveSource, /models\.push\(savedModel\)/);
  assert.doesNotMatch(saveSource, /await load\(\)/);
  assert.doesNotMatch(saveSource, /window\.location\.reload/);
});
