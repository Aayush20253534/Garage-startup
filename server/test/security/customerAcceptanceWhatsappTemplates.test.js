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

test("pickup garage details use the approved template while self-drop uses explicit instructions", () => {
  const source = extractFunction(
    "sendCustomerGarageDetailsWhatsapp",
    "sendCustomerVehicleDeliveredWhatsapp",
  );

  assert.match(source, /sendWhatsappTemplateMessage\s*\(/);
  assert.match(source, /CUSTOMER_BOOKING_CONFIRMED_TEMPLATE/);
  assert.match(source, /languageCode:\s*CUSTOMER_BOOKING_CONFIRMED_LANGUAGE/);
  assert.match(source, /booking\.bookingCode \|\| booking\.id/);
  assert.match(source, /garage\.name \|\| "Assigned garage"/);
  assert.match(source, /garagePhone/);
  assert.match(source, /garageAddress/);
  assert.match(source, /mapsLink/);

  const bodyParameters = source.match(
    /parameters:\s*\[([\s\S]*?)\],\s*buttons:/,
  );
  assert.ok(bodyParameters, "customer template body parameters must exist");
  assert.match(bodyParameters[1], /booking\.bookingCode \|\| booking\.id/);
  assert.match(bodyParameters[1], /garage\.name \|\| "Assigned garage"/);
  assert.match(bodyParameters[1], /garagePhone/);
  assert.match(bodyParameters[1], /garageAddress/);
  assert.doesNotMatch(
    bodyParameters[1],
    /mapsLink/,
    "map URL must be sent through the URL button, not as a fifth body variable",
  );

  assert.match(source, /mapButtonParameter/);
  assert.match(source, /buttons:\s*\[/);
  assert.match(source, /subType:\s*"url"/);
  assert.match(source, /parameters:\s*\[mapButtonParameter\]/);
  assert.match(source, /registered email address/);
  assert.match(source, /if \(isSelfDropOff\)/);
  assert.match(source, /return sendWhatsappMessage\s*\(/);
});

test("customer booking confirmation uses its own plain-English language code", () => {
  assert.match(
    whatsappServiceSource,
    /WHATSAPP_CUSTOMER_BOOKING_CONFIRMED_LANGUAGE\s*\|\|\s*"en"/,
  );
  assert.match(
    envExampleSource,
    /^WHATSAPP_CUSTOMER_BOOKING_CONFIRMED_LANGUAGE=en$/m,
  );

  const garageRequest = extractFunction(
    "sendGarageBookingRequestWhatsapp",
    "sendGarageCustomerLocationWhatsapp",
  );
  const garageAccepted = extractFunction(
    "sendGarageCustomerLocationWhatsapp",
    "sendCustomerGarageDetailsWhatsapp",
  );

  assert.match(garageRequest, /languageCode:\s*DEFAULT_TEMPLATE_LANGUAGE/);
  assert.match(garageAccepted, /languageCode:\s*DEFAULT_TEMPLATE_LANGUAGE/);
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

test("WhatsApp environment exposes the required customer, garage, and worker templates", () => {
  const templateVariables = envExampleSource
    .split(/\r?\n/)
    .filter((line) => /^WHATSAPP_.+_TEMPLATE=/.test(line));

  assert.deepEqual(templateVariables.sort(), [
    "WHATSAPP_GARAGE_REQUEST_TEMPLATE=garage_booking_request",
    "WHATSAPP_GARAGE_ACCEPTED_DETAILS_TEMPLATE=garage_booking_accepted_details",
    "WHATSAPP_CUSTOMER_BOOKING_CONFIRMED_TEMPLATE=customer_booking_confirmed",
    "WHATSAPP_WORKER_TASK_TEMPLATE=garage_worker_task_assignment",
  ].sort());
});
