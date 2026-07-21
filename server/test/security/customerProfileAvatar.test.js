const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("customer profile pictures are image-only and capped at 7 MB", () => {
  const routes = read("server/src/customer/routes/customer.routes.js");
  const uploadMiddleware = read("server/src/middlewares/upload.middleware.js");
  const service = read("server/src/customer/services/customer.service.js");
  const profile = read("client/src/pages/customer/Profile.jsx");

  assert.match(routes, /fileSize: 7 \* 1024 \* 1024/);
  assert.match(routes, /allowedMimeTypes: upload\.IMAGE_MIME_TYPES/);
  assert.match(routes, /upload\.validateUploadedFiles/);
  assert.match(routes, /\.single\("avatar"\)/);
  assert.match(uploadMiddleware, /isValidImageSignature/);
  assert.match(service, /file\.size > AVATAR_MAX_BYTES/);
  assert.match(profile, /file\.size > AVATAR_MAX_BYTES/);
  assert.match(service, /AVATAR_MAX_BYTES = 7 \* 1024 \* 1024/);
  assert.match(profile, /AVATAR_MAX_BYTES = 7 \* 1024 \* 1024/);
  assert.match(profile, /Profile picture must be 7 MB or smaller/);
  assert.match(profile, /maximum 7 MB/);
  assert.match(profile, /body\.append\("avatar", file\)/);
});

test("avatar replacement updates the customer and cleans Cloudinary files", () => {
  const service = read("server/src/customer/services/customer.service.js");
  const controller = read("server/src/customer/controllers/customer.controller.js");

  assert.match(service, /uploadToCloudinary\([\s\S]*AVATAR_FOLDER/);
  assert.match(service, /avatarUrl: uploaded\.secure_url/);
  assert.match(service, /avatarPublicId: uploaded\.public_id/);
  assert.match(service, /catch \(error\)[\s\S]*deleteCloudinaryImagesIfUnreferenced/);
  assert.match(service, /user\.customerProfile\.avatarPublicId/);
  assert.match(controller, /uploadProfileAvatar/);
});

test("customer sidebar identity opens Profile and renders the saved avatar", () => {
  const layout = read("client/src/layouts/DashboardLayout.jsx");
  const navbar = read("client/src/components/navbar/Navbar.jsx");
  const avatar = read("client/src/components/customer/CustomerAvatar.jsx");

  assert.match(layout, /to="\/dashboard\/profile"/);
  assert.match(layout, /aria-label="Open customer profile"/);
  assert.match(layout, /CustomerAvatar/);
  assert.match(navbar, /CustomerAvatar/);
  assert.match(avatar, /customerProfile\?\.avatarUrl/);
  assert.match(avatar, /SafeImage/);
});
