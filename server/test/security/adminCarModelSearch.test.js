const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const readProjectFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("admin car model search is validated and applied by the database query", () => {
  const validation = readProjectFile(
    "server/src/admin/validations/carMeta.validation.js",
  );
  const service = readProjectFile("server/src/admin/services/carMeta.service.js");
  const listStart = service.indexOf("const listBrands");
  const listSource = service.slice(listStart, service.indexOf("const createBrand"));

  assert.match(validation, /query\("modelSearch"\)/);
  assert.match(listSource, /const modelSearch = normalizeName\(query\.modelSearch\)/);
  assert.match(listSource, /models: \{ some: modelWhere \}/);
  assert.match(listSource, /models: \{[\s\S]*where: modelWhere/);
});

test("admin cars UI sends independent brand and model search terms", () => {
  const page = readProjectFile("client/src/pages/admin/Cars.jsx");

  assert.match(page, /const \[modelSearch, setModelSearch\] = useState\(""\)/);
  assert.match(page, /modelSearch\.trim\(\)/);
  assert.match(page, /placeholder="Search brands"/);
  assert.match(page, /placeholder="Search models"/);
  assert.match(page, /event\.preventDefault\(\)/);
});
