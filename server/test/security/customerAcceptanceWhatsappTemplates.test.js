const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8");

const whatsappServiceSource = readSource(
  "src/services/garageWhatsapp.service.js",
);
const garageRequestSource = readSource(
  "src/services/garageRequest.service.js",
);
const bookingLifecycleSource = readSource(
  "src/services/bookingLifecycle.service.js",
);
const envExampleSource = readSource(".env.example");

const extractFunction = (name, nextName) => {
  const start = whatsappServiceSource.indexOf(`const ${name} =`);
  const end = whatsappServiceSource.indexOf(`const ${nextName} =`, start + 1);

  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return whatsappServiceSource.slice(start, end);
};

test("customer garage details use the single approved customer WhatsApp template", () => {
  const source = extractFunction(
    "sendCustomerGarageDetailsWhatsapp",
    "sendCustomerVehicleDeliveredWhatsapp",
  );

  assert.match(source, /sendWhatsappTemplateMessage\s*\(/);
  assert.match(source, /CUSTOMER_BOOKING_CONFIRMED_TEMPLATE/);
  assert.match(source, /booking\.bookingCode \|\| booking\.id/);
  assert.match(source, /garage\.name \|\| "Assigned garage"/);
  assert.match(source, /garagePhone/);
  assert.match(source, /garageAddress/);
  assert.match(source, /mapsLink/);
  assert.match(source, /mapButtonParameter/);
  assert.match(source, /buttons:\s*\[/);
  assert.match(source, /subType:\s*"url"/);
  assert.match(source, /parameters:\s*\[mapButtonParameter\]/);
  assert.match(source, /registered email address/);
  assert.doesNotMatch(source, /return sendWhatsappMessage\s*\(/);
});

test("handover OTP is email-only and no customer OTP WhatsApp template remains", () => {
  assert.doesNotMatch(
    whatsappServiceSource,
    /sendCustomerHandoverOtpWhatsapp|CUSTOMER_HANDOVER_OTP_TEMPLATE|customer_handover_otp/,
  );
  assert.doesNotMatch(
    bookingLifecycleSource,
    /sendCustomerHandoverOtpWhatsapp/,
  );
  assert.doesNotMatch(
    garageRequestSource,
    /sendCustomerHandoverOtpWhatsapp/,
  );
  assert.doesNotMatch(
    envExampleSource,
    /WHATSAPP_CUSTOMER_HANDOVER_OTP_TEMPLATE/,
  );
  assert.match(
    bookingLifecycleSource,
    /sendCustomerHandoverOtpEmail\s*\(/,
  );
});

test("garage acceptance sends one customer WhatsApp and logs OTP email delivery", () => {
  assert.match(
    garageRequestSource,
    /sendCustomerGarageDetailsWhatsapp\s*\(/,
  );
  assert.match(
    garageRequestSource,
    /bookingLifecycleService\.sendCustomerHandoverOtpEmail\s*\(/,
  );
  assert.match(
    garageRequestSource,
    /\[garage-request:accept\] customer notification results/,
  );
  assert.match(garageRequestSource, /garageDetailsWhatsappSent/);
  assert.match(garageRequestSource, /handoverOtpEmailSent/);
  assert.doesNotMatch(garageRequestSource, /handoverOtpWhatsapp/i);
});

test("WhatsApp environment exposes exactly the three required template names", () => {
  const templateVariables = envExampleSource
    .split(/\r?\n/)
    .filter((line) => /^WHATSAPP_.+_TEMPLATE=/.test(line));

  assert.deepEqual(templateVariables, [
    "WHATSAPP_GARAGE_REQUEST_TEMPLATE=garage_booking_request",
    "WHATSAPP_GARAGE_ACCEPTED_DETAILS_TEMPLATE=garage_booking_accepted_details",
    "WHATSAPP_CUSTOMER_BOOKING_CONFIRMED_TEMPLATE=customer_booking_confirmed",
  ]);
});
