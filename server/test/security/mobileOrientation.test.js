const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("every installable Rovauto app requests portrait orientation", () => {
  const manifests = [
    "site.webmanifest",
    "garage.webmanifest",
    "admin.webmanifest",
    "intern.webmanifest",
    "support.webmanifest",
  ];

  manifests.forEach((filename) => {
    const manifest = JSON.parse(read(`client/public/${filename}`));
    assert.equal(manifest.orientation, "portrait-primary", filename);
  });
});

test("mobile browser landscape mode renders the portrait guard", () => {
  const entrypoint = read("client/src/main.jsx");
  const guard = read(
    "client/src/components/common/MobilePortraitGuard.jsx",
  );
  const styles = read("client/src/index.css");

  assert.match(entrypoint, /<MobilePortraitGuard\s*\/>/);
  assert.match(guard, /Rotate to portrait/);
  assert.match(
    styles,
    /@media \(orientation: landscape\) and \(max-height: 540px\) and \(pointer: coarse\)/,
  );
  assert.match(styles, /\.mobile-portrait-guard\s*\{[\s\S]*?display: grid;/);
});
