const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  redactSensitiveText,
  sanitizeAssistantAnswer,
} = require("../../src/customer/security/chatbotPrivacy");

const knowledgeDir = path.join(
  __dirname,
  "..",
  "..",
  "src",
  "customer",
  "knowledge",
);

const readKnowledge = () =>
  fs
    .readdirSync(knowledgeDir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => fs.readFileSync(path.join(knowledgeDir, file), "utf8"))
    .join("\n");

test("chatbot privacy filter redacts credentials and customer contact details", () => {
  const value = redactSensitiveText(
    "OTP is 807500, password: secret123, email me at customer@example.com, call +91 9876543210, card 4111 1111 1111 1111 and Bearer abcdefghijklmnop.",
  );

  assert.doesNotMatch(value, /807500/);
  assert.doesNotMatch(value, /secret123/);
  assert.doesNotMatch(value, /customer@example\.com/);
  assert.doesNotMatch(value, /9876543210/);
  assert.doesNotMatch(value, /4111 1111 1111 1111/);
  assert.doesNotMatch(value, /abcdefghijklmnop/);
  assert.match(value, /\[REDACTED\]/);
  assert.match(value, /\[REDACTED_EMAIL\]/);
  assert.match(value, /\[REDACTED_PHONE\]/);
  assert.match(value, /\[REDACTED_PAYMENT_NUMBER\]/);
});

test("assistant output sanitizer removes internal source paths and privileged routes", () => {
  const answer = sanitizeAssistantAnswer(
    "Open server/src/admin/services/dangerous.service.js or /api/v1/admin/dangerous/run with OTP: 123456.",
  );

  assert.doesNotMatch(answer, /server\/src\/admin/);
  assert.doesNotMatch(answer, /\/api\/v1\/admin\/dangerous/);
  assert.doesNotMatch(answer, /123456/);
  assert.match(answer, /internal detail removed/);
  assert.match(answer, /internal route removed/);
});

test("customer knowledge documents the current safe booking experience", () => {
  const knowledge = readKnowledge();

  assert.match(knowledge, /selected saved service location/i);
  assert.match(knowledge, /does not request the customer's current browser GPS/i);
  assert.match(knowledge, /explicitly edit, confirm, and save the service address/i);
  assert.match(knowledge, /live location sharing belongs to the assigned garage/i);
  assert.match(knowledge, /within 5 km/i);
  assert.match(knowledge, /expands to 10 km/i);
  assert.match(knowledge, /expands to 20 km/i);
  assert.match(knowledge, /starts a new cycle from 5 km/i);
  assert.match(knowledge, /no extra platform-fee payment/i);
  assert.match(knowledge, /30-day Rovauto service warranty/i);
  assert.match(knowledge, /aggregate rating is zero/i);
});

test("customer knowledge excludes deployment secrets and internal implementation details", () => {
  const knowledge = readKnowledge();

  assert.doesNotMatch(
    knowledge,
    /DATABASE_URL|DIRECT_URL|JWT_SECRET|GROQ_API_KEY|REDIS_URL|WHATSAPP_ACCESS_TOKEN|CASHFREE_SECRET|CLOUDINARY_API_SECRET/i,
  );
  assert.doesNotMatch(knowledge, /server\/src\/|client\/src\/|\/api\/v1\/admin/i);
  assert.doesNotMatch(knowledge, /Prisma|PostGIS|Redis|database schema|environment variable/i);
  assert.doesNotMatch(knowledge, /garage acceptance fee|garage wallet balance/i);
});

test("chatbot model context uses only minimal account signals", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "src",
      "customer",
      "services",
      "chatbot.service.js",
    ),
    "utf8",
  );

  assert.match(source, /hasVehicle/);
  assert.match(source, /hasSavedLocation/);
  assert.match(source, /latestBooking/);
  assert.doesNotMatch(source, /defaultVehicle:/);
  assert.doesNotMatch(source, /garageCity:/);
  assert.doesNotMatch(source, /registrationNumber/);
  assert.doesNotMatch(source, /customerAddress/);
});
