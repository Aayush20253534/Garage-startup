const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildTemplatePayload,
} = require("../../src/services/whatsappTemplatePayload");

test("garage request template separates body variables from the dynamic URL button", () => {
  const payload = buildTemplatePayload({
    phone: "919876543210",
    templateName: "garage_booking_request",
    languageCode: "en_US",
    parameters: ["Maruti Suzuki", "Swift Dzire", "Periodic Service"],
    buttons: [
      {
        subType: "url",
        index: 0,
        parameters: ["831c1ecd-bb0e-46d7-a730-7b3b40d0dc41"],
      },
    ],
  });

  assert.deepEqual(payload.template.components, [
    {
      type: "body",
      parameters: [
        { type: "text", text: "Maruti Suzuki" },
        { type: "text", text: "Swift Dzire" },
        { type: "text", text: "Periodic Service" },
      ],
    },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        { type: "text", text: "831c1ecd-bb0e-46d7-a730-7b3b40d0dc41" },
      ],
    },
  ]);
});

test("template payload does not include an empty body component", () => {
  const payload = buildTemplatePayload({
    phone: "919876543210",
    templateName: "button_only_template",
    buttons: [
      {
        subType: "url",
        index: 0,
        parameters: ["request-id"],
      },
    ],
  });

  assert.equal(payload.template.components.length, 1);
  assert.equal(payload.template.components[0].type, "button");
});
