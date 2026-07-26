const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8");

test("booking inspection evidence accepts 5 to 15 photos and requires one 50 MB video", () => {
  const constantsSource = readSource("src/garage/constants.js");
  const routeSource = readSource("src/routes/garageRequest.routes.js");
  const lifecycleSource = readSource("src/services/bookingLifecycle.service.js");

  assert.match(constantsSource, /MIN_BOOKING_INSPECTION_IMAGES = 5/);
  assert.match(constantsSource, /MAX_BOOKING_INSPECTION_IMAGES = 15/);
  assert.match(constantsSource, /REQUIRED_BOOKING_INSPECTION_VIDEOS = 1/);
  assert.match(
    constantsSource,
    /MAX_BOOKING_INSPECTION_VIDEO_SIZE_BYTES = 50 \* 1024 \* 1024/,
  );
  assert.match(routeSource, /\{ name: "images", maxCount: 15 \}/);
  assert.match(routeSource, /\{ name: "video", maxCount: 1 \}/);
  assert.match(routeSource, /createDiskUpload/);
  assert.match(lifecycleSource, /files\.length < MIN_INSPECTION_PHOTO_COUNT/);
  assert.match(lifecycleSource, /files\.length > MAX_INSPECTION_PHOTO_COUNT/);
  assert.match(lifecycleSource, /Exactly one car inspection video is required/);
  assert.match(lifecycleSource, /car inspection video must be 50 MB or less/);
});

test("garage UI blocks start and completion until photo range and video are present", () => {
  const detailSource = readSource("../client/src/pages/garage/BookingDetail.jsx");
  const apiSource = readSource("../client/src/api/garage.js");
  const videoUploadSource = readSource(
    "../client/src/components/garage/VideoUpload.jsx",
  );

  assert.match(detailSource, /min=\{5\}/);
  assert.match(detailSource, /max=\{15\}/);
  assert.match(detailSource, /!preServiceVideo/);
  assert.match(detailSource, /!postServiceVideo/);
  assert.match(detailSource, /preServiceImages\.length < 5/);
  assert.match(detailSource, /postServiceImages\.length > 15/);
  assert.match(apiSource, /formData\.append\("video", videoFile\)/);
  assert.match(videoUploadSource, /MAX_VIDEO_SIZE_MB = 50/);
});

test("inspection media schema differentiates videos from legacy images", () => {
  const schemaSource = readSource("prisma/schema.prisma");
  const migrationSource = readSource(
    "prisma/migrations/20260726070000_add_booking_inspection_video/migration.sql",
  );
  const gallerySource = readSource(
    "../client/src/components/booking/InspectionGallery.jsx",
  );

  assert.match(schemaSource, /mediaType BookingInspectionMediaType @default\(IMAGE\)/);
  assert.match(
    schemaSource,
    /@@unique\(\[bookingId, phase, mediaType, order\]\)/,
  );
  assert.match(migrationSource, /CREATE TYPE "BookingInspectionMediaType"/);
  assert.match(gallerySource, /item\?\.mediaType === "VIDEO"/);
  assert.match(gallerySource, /<video/);
});
