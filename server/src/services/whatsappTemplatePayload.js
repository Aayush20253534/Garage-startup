const toTextParameter = (value) => ({
  type: "text",
  text: String(value ?? "-").slice(0, 1024),
});

const toButtonParameter = (parameter) => {
  if (parameter && typeof parameter === "object" && parameter.type) {
    return parameter;
  }

  return toTextParameter(parameter);
};

const buildTemplatePayload = ({
  phone,
  templateName,
  languageCode,
  parameters = [],
  buttons = [],
}) => {
  const components = [];

  if (parameters.length > 0) {
    components.push({
      type: "body",
      parameters: parameters.map(toTextParameter),
    });
  }

  for (const button of buttons) {
    if (!button || !button.subType || button.index === undefined) continue;

    components.push({
      type: "button",
      sub_type: button.subType,
      index: String(button.index),
      parameters: (button.parameters || []).map(toButtonParameter),
    });
  }

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components,
    },
  };
};

module.exports = {
  buildTemplatePayload,
};
