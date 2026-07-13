const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const whatsappServiceSource = fs.readFileSync(
  path.join(__dirname, "../../src/services/garageWhatsapp.service.js"),
  "utf8",
);
const garageRequestSource = fs.readFileSync(
  path.join(__dirname, "../../src/services/garageRequest.service.js"),
  "utf8",
);

const extractFunction = (name, nextName) => {
  const start = whatsappServiceSource.indexOf(`const ${name} =`);
  const end = whatsappServiceSource.indexOf(`const ${nextName} =`, start + 1);

  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return whatsappServiceSource.slice(start, end);
};

test("customer booking confirmation uses an approved WhatsApp template", () => {
  const source = extractFunction(
    "sendCustomerGarageDetailsWhatsapp",
    "sendCustomerHandoverOtpWhatsapp",
  );

  assert.match(source, /sendWhatsappTemplateMessage\s*\(/);
  assert.match(source, /CUSTOMER_BOOKING_CONFIRMED_TEMPLATE/);
  assert.match(source, /booking\.bookingCode \|\| booking\.id/);
  assert.match(source, /garage\.name \|\| "Assigned garage"/);
  assert.match(source, /garagePhone/);
  assert.match(source, /garageAddress/);
  assert.match(source, /mapsLink/);
  assert.doesNotMatch(source, /return sendWhatsappMessage\s*\(/);
});

test("customer handover OTP uses an approved WhatsApp template", () => {
  const source = extractFunction(
    "sendCustomerHandoverOtpWhatsapp",
    "sendCustomerVehicleDeliveredWhatsapp",
  );

  assert.match(source, /sendWhatsappTemplateMessage\s*\(/);
  assert.match(source, /CUSTOMER_HANDOVER_OTP_TEMPLATE/);
  assert.match(source, /booking\.bookingCode \|\| booking\.id/);
  assert.match(source, /otpExpiry/);
  assert.match(source, /garage\?\.name \|\| "the assigned garage"/);
  assert.doesNotMatch(source, /return sendWhatsappMessage\s*\(/);
});

test("garage acceptance logs both customer template delivery results", () => {
  assert.match(
    garageRequestSource,
    /\[garage-request:accept\] customer WhatsApp results/,
  );
  assert.match(garageRequestSource, /garageDetailsSent/);
  assert.match(garageRequestSource, /handoverOtpSent/);
  assert.match(
    garageRequestSource,
    /return \{ garageDetails, handoverOtp \};/,
  );
});
