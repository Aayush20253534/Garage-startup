const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSafeProbeUrl,
  isReservedSystemIssueMetadataKey,
  isUntrustedPublicIssue,
} = require("../../src/services/security/systemIssueProbePolicy");

const BASE_URL = "https://api.rovauto.com/api/v1";

test("unauthenticated public issues are never eligible for network probes", () => {
  assert.equal(
    isUntrustedPublicIssue({ actorType: "PUBLIC", userId: null }),
    true,
  );
  assert.equal(
    isUntrustedPublicIssue({ actorType: "CUSTOMER", userId: "customer-1" }),
    false,
  );
});

test("safe relative API endpoints are pinned to the configured API origin", () => {
  assert.equal(
    buildSafeProbeUrl({ endpoint: "/cities", baseUrl: BASE_URL }),
    "https://api.rovauto.com/api/v1/cities",
  );
  assert.equal(
    buildSafeProbeUrl({ endpoint: "/api/v1/cities", baseUrl: BASE_URL }),
    "https://api.rovauto.com/api/v1/cities",
  );
});

test("same-origin absolute endpoints are allowed only inside the API base path", () => {
  assert.equal(
    buildSafeProbeUrl({
      endpoint: "https://api.rovauto.com/api/v1/cities?limit=100#section",
      baseUrl: BASE_URL,
    }),
    "https://api.rovauto.com/api/v1/cities",
  );
  assert.equal(
    buildSafeProbeUrl({
      endpoint: "https://api.rovauto.com/internal/health",
      baseUrl: BASE_URL,
    }),
    null,
  );
});

test("cross-origin, protocol-relative, credentialed, and traversal targets are rejected", () => {
  const blocked = [
    "http://127.0.0.1:5000/admin",
    "http://169.254.169.254/latest/meta-data",
    "https://evil.example/api/v1/cities",
    "//evil.example/api/v1/cities",
    "https://user:pass@api.rovauto.com/api/v1/cities",
    "../internal/health",
    "/api/v1/../../internal/health",
    "\\\\evil.example\\share",
  ];

  for (const endpoint of blocked) {
    assert.equal(
      buildSafeProbeUrl({ endpoint, baseUrl: BASE_URL }),
      null,
      `expected ${endpoint} to be rejected`,
    );
  }
});

test("auto-resolver probe metadata keys are reserved case-insensitively", () => {
  assert.equal(isReservedSystemIssueMetadataKey("autoResolveProbeUrl"), true);
  assert.equal(isReservedSystemIssueMetadataKey("AutoResolveProbeUrl"), true);
  assert.equal(isReservedSystemIssueMetadataKey("requestId"), false);
});
