const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8");

test("garage galleries accept 2 MB photos and clients skip oversized selections", () => {
  const routeSource = readSource("src/routes/garageMedia.routes.js");
  const constantsSource = readSource("src/garage/constants.js");
  const serviceSource = readSource("src/services/garageMedia.service.js");
  const uploadSource = readSource("../client/src/components/garage/ImageUpload.jsx");
  const profileSource = readSource("../client/src/pages/garage/Profile.jsx");
  const adminGarageSource = readSource("../client/src/pages/admin/Garages.jsx");

  assert.match(routeSource, /fileSize: 2 \* 1024 \* 1024/);
  assert.match(routeSource, /\{ name: "images", maxCount: 15 \}/);
  assert.match(constantsSource, /GARAGE_MAX_IMAGE_SIZE_BYTES = 2 \* 1024 \* 1024/);
  assert.match(serviceSource, /less than or equal to 2 MB/);
  assert.match(uploadSource, /file\.size <= maxSizeBytes/);
  assert.match(profileSource, /maxSizeMb=\{2\}/);
  assert.match(adminGarageSource, /file\.size <= MAX_GARAGE_PHOTO_SIZE_BYTES/);
  assert.match(adminGarageSource, /over \$\{MAX_GARAGE_PHOTO_SIZE_MB\} MB/);
});

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
    /router\.delete\([\s\S]*\/:garageId\/media\/:imageId[\s\S]*protect[\s\S]*authorizeRoles\("GARAGE_OWNER", "ADMIN", "SUB_ADMIN"\)/,
  );
  assert.match(
    serviceSource,
    /const deleteGarageImage = \(garageId, imageId, user\) =>\s*deleteGarageImages\(garageId, \[imageId\], user\)/,
  );
  assert.match(
    serviceSource,
    /where:\s*\{\s*id: \{ in: uniqueImageIds \},\s*garageId,\s*\}/,
  );
});

test("deleting a garage image compacts ordering and promotes a thumbnail", () => {
  const serviceSource = readSource("src/services/garageMedia.service.js");
  const deleteStart = serviceSource.indexOf("const deleteGarageImage");
  const deleteSource = serviceSource.slice(deleteStart);

  assert.match(deleteSource, /isThumbnail: index === 0/);
  assert.match(deleteSource, /order: index/);
  assert.match(
    deleteSource,
    /deleteCloudinaryImagesIfUnreferenced\(images\.map\(\(image\) => image\.publicId\)\)/,
  );
});

test("admins and sub-admins can select and atomically delete multiple garage photos", () => {
  const routeSource = readSource("src/routes/garageMedia.routes.js");
  const serviceSource = readSource("src/services/garageMedia.service.js");
  const controllerSource = readSource("src/controllers/garageMedia.controller.js");
  const adminGarageSource = readSource("../client/src/pages/admin/Garages.jsx");
  const adminApiSource = readSource("../client/src/api/admin.js");

  assert.match(
    routeSource,
    /router\.delete\([\s\S]*\/:garageId\/media[\s\S]*authorizeRoles\("ADMIN", "SUB_ADMIN"\)[\s\S]*deleteGarageImages/,
  );
  assert.match(controllerSource, /req\.body\?\.imageIds/);
  assert.match(serviceSource, /garageImage\.deleteMany/);
  assert.match(serviceSource, /id: \{ in: uniqueImageIds \}/);
  assert.match(adminGarageSource, /selectedPhotoIds/);
  assert.match(adminGarageSource, /Delete selected \(\$\{selectedPhotoIds\.length\}\)/);
  assert.match(adminApiSource, /data: \{ imageIds \}/);
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
