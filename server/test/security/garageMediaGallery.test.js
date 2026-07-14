const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8");

test("garage media uploads append within the remaining gallery capacity", () => {
  const serviceSource = readSource("src/services/garageMedia.service.js");
  const uploadStart = serviceSource.indexOf("const uploadGarageMedia");
  const deleteStart = serviceSource.indexOf("const deleteGarageImage");
  const uploadSource = serviceSource.slice(uploadStart, deleteStart);

  assert.match(uploadSource, /GARAGE_MAXIMUM_IMAGES - garage\._count\.images/);
  assert.match(uploadSource, /GARAGE_MAXIMUM_IMAGES - existingImages\.length/);
  assert.match(uploadSource, /nextOrder \+ index/);
  assert.match(uploadSource, /isThumbnail: !hasThumbnail && index === 0/);
  assert.doesNotMatch(uploadSource, /garageImage\.deleteMany/);
});

test("garage owners can delete only an image belonging to their garage", () => {
  const serviceSource = readSource("src/services/garageMedia.service.js");
  const routeSource = readSource("src/routes/garageMedia.routes.js");

  assert.match(
    routeSource,
    /router\.delete\([\s\S]*\/:garageId\/media\/:imageId[\s\S]*protect[\s\S]*authorizeRoles\("GARAGE_OWNER", "ADMIN"\)/,
  );
  assert.match(
    serviceSource,
    /where:\s*\{\s*id: imageId,\s*garageId,\s*\}/,
  );
});

test("deleting a garage image compacts ordering and promotes a thumbnail", () => {
  const serviceSource = readSource("src/services/garageMedia.service.js");
  const deleteStart = serviceSource.indexOf("const deleteGarageImage");
  const deleteSource = serviceSource.slice(deleteStart);

  assert.match(deleteSource, /isThumbnail: index === 0/);
  assert.match(deleteSource, /order: index/);
  assert.match(deleteSource, /deleteCloudinaryImagesIfUnreferenced\(\[image\.publicId\]\)/);
});

test("garage profile limits new selections to free slots and exposes per-photo deletion", () => {
  const profileSource = readSource("../client/src/pages/garage/Profile.jsx");
  const apiSource = readSource("../client/src/api/garage.js");

  assert.match(
    profileSource,
    /MAX_GARAGE_PHOTOS - uploadedImages\.length/,
  );
  assert.match(profileSource, /max=\{remainingPhotoSlots\}/);
  assert.match(profileSource, /onDelete=\{deletePhoto\}/);
  assert.match(apiSource, /api\.delete\(`\/garages\/\$\{garageId\}\/media\/\$\{imageId\}`\)/);
});
