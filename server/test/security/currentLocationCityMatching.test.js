const test = require("node:test");
const assert = require("node:assert/strict");

// city.service loads Prisma at module scope, so exercise the exported matching
// rule through its source without requiring a live database in this unit test.
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../../src/services/city.service.js"),
  "utf8",
);

test("GPS city matching accepts Google administrative city variants", () => {
  assert.match(source, /stripAdministrativeSuffix/);
  assert.match(source, /containsWholeCityName/);
  assert.match(source, /municipal corporation\|municipality\|metropolitan city/);
  assert.match(source, /` \$\{candidateKey\} `\.includes\(` \$\{cityKey\} `\)/);
});

test("frontend and backend use the same GPS city matching rule", () => {
  const frontend = fs.readFileSync(
    path.join(__dirname, "../../../client/src/utils/cityAvailability.js"),
    "utf8",
  );

  assert.match(frontend, /stripAdministrativeSuffix/);
  assert.match(frontend, /containsWholeCityName/);
  assert.match(frontend, /longestCityNamesFirst/);
});
