const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("vehicle models persist Cloudinary image metadata through a migration", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260726193000_add_vehicle_model_photos/migration.sql",
  );

  assert.match(
    schema,
    /model VehicleModel[\s\S]*imageUrl\s+String\?[\s\S]*imagePublicId\s+String\?/,
  );
  assert.match(migration, /ALTER TABLE "VehicleModel"/);
  assert.match(migration, /ADD COLUMN "imageUrl" TEXT/);
  assert.match(migration, /ADD COLUMN "imagePublicId" TEXT/);
});

test("car model create and update routes accept one validated 2 MB photo", () => {
  const routes = read("server/src/admin/routes/carMeta.routes.js");
  const controller = read("server/src/admin/controllers/carMeta.controller.js");

  assert.match(routes, /const modelPhotoUpload = upload\.createUpload\(\{/);
  assert.match(routes, /fileSize: 2 \* 1024 \* 1024/);
  assert.match(routes, /\.single\("photo"\)/);
  assert.match(
    routes,
    /\/brands\/:brandId\/models"[\s\S]*modelPhotoUpload[\s\S]*upload\.validateUploadedFiles/,
  );
  assert.match(
    routes,
    /\/models\/:modelId"[\s\S]*modelPhotoUpload[\s\S]*upload\.validateUploadedFiles/,
  );
  assert.match(controller, /createModel\(req\.params\.brandId, req\.body, req\.file\)/);
  assert.match(controller, /updateModel\(req\.params\.modelId, req\.body, req\.file\)/);
});

test("car model photos are uploaded, replaced, rolled back, and deleted safely", () => {
  const service = read("server/src/admin/services/carMeta.service.js");

  assert.match(service, /MODEL_PHOTO_MAX_SIZE = 2 \* 1024 \* 1024/);
  assert.match(service, /MODEL_PHOTO_FOLDER = "rovauto\/vehicle-models"/);
  assert.match(service, /Car model photo must be under 2 MB/);
  assert.match(service, /imageUrl: result\.secure_url/);
  assert.match(service, /imagePublicId: result\.public_id/);
  assert.match(service, /deleteUploadedModelPhoto\(photo\)/);
  assert.match(service, /existingModel\.imagePublicId/);
  assert.match(service, /deleteFromCloudinary\(existingModel\.imagePublicId, "image"\)/);
  assert.match(service, /invalidateVehicleMetaCache\(\)/);
});

test("admin and customer model catalog UIs show model photos", () => {
  const cars = read("client/src/pages/admin/Cars.jsx");
  const vehicleSelect = read("client/src/pages/booking/VehicleSelect.jsx");
  const categoryDetail = read("client/src/pages/CategoryDetail.jsx");
  const garageServices = read("client/src/pages/garage/Services.jsx");

  assert.match(cars, /MAX_MODEL_PHOTO_BYTES = 2 \* 1024 \* 1024/);
  assert.match(cars, /payload\.append\("photo", modelForm\.photo\)/);
  assert.match(cars, /model\.imageUrl/);
  assert.match(vehicleSelect, /catalogModel\.imageUrl/);
  assert.match(vehicleSelect, /src=\{m\.image\}/);
  assert.match(categoryDetail, /draftSelectedModel\.imageUrl/);
  assert.match(garageServices, /selectedModelRecord\.imageUrl/);
});
