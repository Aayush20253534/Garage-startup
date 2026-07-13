const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getCustomerMapButtonParameter,
} = require("../../src/services/garageAcceptedWhatsappTemplate");
const {
  buildTemplatePayload,
} = require("../../src/services/whatsappTemplatePayload");

test("garage accepted-details template includes the required dynamic map button", () => {
  const mapButtonParameter = getCustomerMapButtonParameter({
    customerLatitude: 25.4952796,
    customerLongitude: 81.8689635,
  });

  const payload = buildTemplatePayload({
    phone: "919876543210",
    templateName: "garage_booking_accepted_details",
    languageCode: "en_US",
    parameters: [
      "Ayush Kumar Jha",
      "+919876543210",
      "Civil Lines, Prayagraj",
      "https://www.google.com/maps?q=25.4952796,81.8689635",
    ],
    buttons: [
      {
        subType: "url",
        index: 0,
        parameters: [mapButtonParameter],
      },
    ],
  });

  assert.equal(mapButtonParameter, "25.4952796%2C81.8689635");
  assert.deepEqual(payload.template.components, [
    {
      type: "body",
      parameters: [
        { type: "text", text: "Ayush Kumar Jha" },
        { type: "text", text: "+919876543210" },
        { type: "text", text: "Civil Lines, Prayagraj" },
        {
          type: "text",
          text: "https://www.google.com/maps?q=25.4952796,81.8689635",
        },
      ],
    },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: "25.4952796%2C81.8689635" }],
    },
  ]);
});

test("garage accepted map button falls back to an encoded address", () => {
  assert.equal(
    getCustomerMapButtonParameter({
      customerAddress: "Civil Lines, Prayagraj",
    }),
    "Civil%20Lines%2C%20Prayagraj",
  );
});
