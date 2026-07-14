const axios = require("axios");
const {
  getCustomerMapButtonParameter,
} = require("./garageAcceptedWhatsappTemplate");
const { buildTemplatePayload } = require("./whatsappTemplatePayload");
const {
  createWhatsappLink,
  getDefaultCountryCode,
  normalizeWhatsappNumber,
} = require("../utils/whatsapp");

const looksLikeMetaToken = (value) => /^EA[A-Za-z0-9_-]+/.test(String(value || ""));
const looksLikePhoneNumberId = (value) => /^\d{8,}$/.test(String(value || ""));

const getWhatsappPhoneNumberId = () => {
  if (process.env.WHATSAPP_PHONE_NUMBER_ID) return process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (looksLikePhoneNumberId(process.env.WHATSAPP_SENDER_ID)) return process.env.WHATSAPP_SENDER_ID;
  if (looksLikePhoneNumberId(process.env.WHATSAPP_PROVIDER_TOKEN)) return process.env.WHATSAPP_PROVIDER_TOKEN;

  const match = String(process.env.WHATSAPP_PROVIDER_URL || "").match(/\/(\d+)\/messages(?:\?|$)/);
  return match?.[1] || "";
};

const getWhatsappAccessToken = () => {
  if (process.env.WHATSAPP_ACCESS_TOKEN) return process.env.WHATSAPP_ACCESS_TOKEN;
  if (looksLikeMetaToken(process.env.WHATSAPP_PROVIDER_TOKEN)) return process.env.WHATSAPP_PROVIDER_TOKEN;
  if (looksLikeMetaToken(process.env.WHATSAPP_SENDER_ID)) return process.env.WHATSAPP_SENDER_ID;
  return process.env.WHATSAPP_PROVIDER_TOKEN || "";
};

const getWhatsappProviderUrl = () => {
  if (process.env.WHATSAPP_PROVIDER_URL) return process.env.WHATSAPP_PROVIDER_URL;

  const phoneNumberId = getWhatsappPhoneNumberId();
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v25.0";
  return phoneNumberId ? `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages` : "";
};

const isMetaCloudApiUrl = (url) => /graph\.facebook\.com\/.+\/messages/i.test(String(url || ""));
const isWhatsappConfigured = () => Boolean(getWhatsappProviderUrl() && getWhatsappAccessToken());

const DEFAULT_TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
const GARAGE_REQUEST_TEMPLATE =
  process.env.WHATSAPP_GARAGE_REQUEST_TEMPLATE || "garage_booking_request";
const GARAGE_ACCEPTED_DETAILS_TEMPLATE =
  process.env.WHATSAPP_GARAGE_ACCEPTED_DETAILS_TEMPLATE ||
  "garage_booking_accepted_details";
const CUSTOMER_BOOKING_CONFIRMED_TEMPLATE =
  process.env.WHATSAPP_CUSTOMER_BOOKING_CONFIRMED_TEMPLATE ||
  "customer_booking_confirmed";
const CUSTOMER_BOOKING_CONFIRMED_LANGUAGE =
  process.env.WHATSAPP_CUSTOMER_BOOKING_CONFIRMED_LANGUAGE || "en";

const shouldUseTemplates = () => {
  const value = String(process.env.WHATSAPP_USE_TEMPLATES || "true").toLowerCase();
  return !["0", "false", "off", "no"].includes(value);
};

const WHATSAPP_LOG_PREFIX = "[whatsapp]";

const shouldLogWhatsapp = () => {
  const value = String(process.env.WHATSAPP_DEBUG_LOGS || "true").toLowerCase();
  return !["0", "false", "off", "no"].includes(value);
};

const maskPhone = (phone) => {
  const value = String(phone || "");
  if (value.length <= 4) return value || "missing";
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
};

const sanitizeProviderUrl = (url) => {
  const value = String(url || "");
  if (!value) return "missing";
  return value.replace(/access_token=[^&]+/i, "access_token=<redacted>");
};

const summarizeProviderResponse = (data) => {
  if (!data || typeof data !== "object") return data || null;

  return {
    messaging_product: data.messaging_product,
    messageId: data.messages?.[0]?.id,
    contactWaId: data.contacts?.[0]?.wa_id,
    errorCode: data.error?.code,
    errorSubcode: data.error?.error_subcode,
    errorType: data.error?.type,
    errorMessage: data.error?.message,
    errorDetails: data.error?.error_data?.details,
  };
};

const logWhatsapp = (level, event, details = {}) => {
  if (!shouldLogWhatsapp() || process.env.NODE_ENV === "test") return;

  const logger = console[level] || console.log;
  logger(`${WHATSAPP_LOG_PREFIX} ${event}`, details);
};

const getFrontendBaseUrl = () => (process.env.FRONTEND_URL || process.env.CLIENT_URL || "https://www.rovauto.com").replace(/\/+$/, "");

const getGarageAcceptUrl = (requestId) => {
  const acceptPath = process.env.GARAGE_REQUEST_ACCEPT_PATH || "/garage/magic";
  return `${getFrontendBaseUrl()}${acceptPath}/${requestId}`;
};

const getMapsLink = (latitude, longitude) => {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null;
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
};

const getCustomerLocationText = (booking = {}) => {
  return booking.customerAddress || "Customer location shared in booking";
};

const getCustomerMapsLink = (booking = {}) => {
  const coordinateLink = getMapsLink(
    booking.customerLatitude,
    booking.customerLongitude,
  );

  if (coordinateLink) return coordinateLink;

  if (booking.customerAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      booking.customerAddress,
    )}`;
  }

  return "Location map not available";
};

const getGarageMapButtonParameter = (garage = {}) => {
  const hasLatitude =
    garage.latitude !== null &&
    garage.latitude !== undefined &&
    String(garage.latitude).trim() !== "";
  const hasLongitude =
    garage.longitude !== null &&
    garage.longitude !== undefined &&
    String(garage.longitude).trim() !== "";
  const latitude = Number(garage.latitude);
  const longitude = Number(garage.longitude);

  if (
    hasLatitude &&
    hasLongitude &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return encodeURIComponent(`${latitude},${longitude}`);
  }

  return encodeURIComponent(String(garage.address || "India").trim() || "India");
};

const sendWhatsappMessage = async ({ to, message, context = {} }) => {
  const phone = normalizeWhatsappNumber(to);
  const messagePreview = String(message || "").slice(0, 140);

  if (!phone || !message) {
    logWhatsapp("warn", "send.skipped", {
      reason: "missing_phone_or_message",
      rawTo: to ? maskPhone(String(to).replace(/\D/g, "")) : "missing",
      hasMessage: Boolean(message),
      defaultCountryCode: getDefaultCountryCode(),
      ...context,
    });

    return { sent: false, reason: "missing_phone_or_message" };
  }

  if (!isWhatsappConfigured()) {
    const whatsappLink = createWhatsappLink(phone, message);

    logWhatsapp("warn", "send.not_configured", {
      to: maskPhone(phone),
      providerUrl: sanitizeProviderUrl(getWhatsappProviderUrl()),
      hasAccessToken: Boolean(getWhatsappAccessToken()),
      phoneNumberId: getWhatsappPhoneNumberId() || "missing",
      defaultCountryCode: getDefaultCountryCode(),
      whatsappLink,
      messagePreview,
      ...context,
    });

    return { sent: false, logged: true, whatsappLink };
  }

  const providerUrl = getWhatsappProviderUrl();
  const accessToken = getWhatsappAccessToken();
  const metaCloudApi = isMetaCloudApiUrl(providerUrl);
  const payload = metaCloudApi
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "text",
        text: {
          preview_url: true,
          body: message,
        },
      }
    : {
        to: phone,
        recipient: phone,
        phone,
        message,
        text: message,
        from: getWhatsappPhoneNumberId() || undefined,
      };

  logWhatsapp("info", "send.attempt", {
    to: maskPhone(phone),
    provider: metaCloudApi ? "meta_cloud_api" : "custom_provider",
    providerUrl: sanitizeProviderUrl(providerUrl),
    phoneNumberId: getWhatsappPhoneNumberId() || "not_applicable",
    defaultCountryCode: getDefaultCountryCode(),
    messageLength: String(message).length,
    messagePreview,
    ...context,
  });

  try {
    const response = await axios.post(providerUrl, payload, {
      timeout: Number(process.env.WHATSAPP_SEND_TIMEOUT_MS || 15000),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    logWhatsapp("info", "send.success", {
      to: maskPhone(phone),
      status: response.status,
      providerResponse: summarizeProviderResponse(response.data),
      ...context,
    });

    return { sent: true, providerResponse: response.data, status: response.status };
  } catch (error) {
    const status = error.response?.status || null;
    const responseData = error.response?.data || null;

    logWhatsapp("error", "send.failed", {
      to: maskPhone(phone),
      status,
      code: error.code,
      errorMessage: error.message,
      providerError: summarizeProviderResponse(responseData),
      providerResponse: responseData,
      ...context,
    });

    return {
      sent: false,
      failed: true,
      status,
      code: error.code,
      errorMessage: error.message,
      providerResponse: responseData,
    };
  }
};

const sendWhatsappTemplateMessage = async ({
  to,
  templateName,
  parameters = [],
  buttons = [],
  languageCode = DEFAULT_TEMPLATE_LANGUAGE,
  fallbackMessage = "",
  context = {},
}) => {
  const phone = normalizeWhatsappNumber(to);

  if (!phone || !templateName) {
    logWhatsapp("warn", "template.skipped", {
      reason: "missing_phone_or_template",
      rawTo: to ? maskPhone(String(to).replace(/\D/g, "")) : "missing",
      templateName: templateName || "missing",
      defaultCountryCode: getDefaultCountryCode(),
      ...context,
    });

    return { sent: false, reason: "missing_phone_or_template" };
  }

  if (!shouldUseTemplates()) {
    return sendWhatsappMessage({ to, message: fallbackMessage, context });
  }

  if (!isWhatsappConfigured()) {
    const whatsappLink = fallbackMessage
      ? createWhatsappLink(phone, fallbackMessage)
      : null;

    logWhatsapp("warn", "template.not_configured", {
      to: maskPhone(phone),
      providerUrl: sanitizeProviderUrl(getWhatsappProviderUrl()),
      hasAccessToken: Boolean(getWhatsappAccessToken()),
      phoneNumberId: getWhatsappPhoneNumberId() || "missing",
      defaultCountryCode: getDefaultCountryCode(),
      templateName,
      languageCode,
      whatsappLink,
      ...context,
    });

    return { sent: false, logged: true, whatsappLink };
  }

  const providerUrl = getWhatsappProviderUrl();
  const accessToken = getWhatsappAccessToken();
  const metaCloudApi = isMetaCloudApiUrl(providerUrl);

  if (!metaCloudApi) {
    logWhatsapp("warn", "template.unsupported_provider", {
      to: maskPhone(phone),
      providerUrl: sanitizeProviderUrl(providerUrl),
      templateName,
      languageCode,
      ...context,
    });

    return sendWhatsappMessage({ to, message: fallbackMessage, context });
  }

  const payload = buildTemplatePayload({
    phone,
    templateName,
    languageCode,
    parameters,
    buttons,
  });

  logWhatsapp("info", "template.attempt", {
    to: maskPhone(phone),
    provider: "meta_cloud_api",
    providerUrl: sanitizeProviderUrl(providerUrl),
    phoneNumberId: getWhatsappPhoneNumberId() || "not_applicable",
    defaultCountryCode: getDefaultCountryCode(),
    templateName,
    languageCode,
    parameterCount: parameters.length,
    parameterPreview: parameters.map((value) => String(value ?? "-").slice(0, 80)),
    buttonCount: buttons.length,
    buttonPreview: buttons.map((button) => ({
      subType: button?.subType,
      index: button?.index,
      parameterCount: button?.parameters?.length || 0,
    })),
    ...context,
  });

  try {
    const response = await axios.post(providerUrl, payload, {
      timeout: Number(process.env.WHATSAPP_SEND_TIMEOUT_MS || 15000),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    logWhatsapp("info", "template.success", {
      to: maskPhone(phone),
      status: response.status,
      templateName,
      providerResponse: summarizeProviderResponse(response.data),
      ...context,
    });

    return { sent: true, providerResponse: response.data, status: response.status };
  } catch (error) {
    const status = error.response?.status || null;
    const responseData = error.response?.data || null;
    const providerError = responseData?.error || null;
    const errorMessage =
      providerError?.error_data?.details ||
      providerError?.message ||
      error.message;

    logWhatsapp("error", "template.failed", {
      to: maskPhone(phone),
      status,
      code: error.code,
      errorMessage,
      templateName,
      providerError: summarizeProviderResponse(responseData),
      providerResponse: responseData,
      ...context,
    });

    return {
      sent: false,
      failed: true,
      status,
      code: error.code,
      errorMessage,
      providerErrorCode: providerError?.code || null,
      providerErrorSubcode: providerError?.error_subcode || null,
      providerResponse: responseData,
    };
  }
};


const formatVehicleDetails = (vehicle) => {
  if (!vehicle) return "Vehicle details unavailable";
  return [vehicle.brand, vehicle.model, vehicle.registrationNumber || vehicle.numberPlate, vehicle.fuelType]
    .filter(Boolean)
    .join(" | ") || "Vehicle details unavailable";
};

const formatServiceList = (services = []) => {
  return services
    .map((item) => item.service?.name || item.name)
    .filter(Boolean)
    .join(", ") || "Selected services";
};

const formatBookingAmount = (booking) => {
  const amount = Number(booking.totalServiceMaxAmount || booking.totalServiceAmount || booking.payableAmount || 0);
  return amount > 0 ? `Rs. ${amount.toLocaleString("en-IN")}` : "To be confirmed";
};

const sendGarageBookingRequestWhatsapp = async ({
  garage,
  request,
  booking,
  acceptFee = 0,
}) => {
  const acceptUrl = getGarageAcceptUrl(request.id);
  const brand = booking.vehicle?.brand || "Vehicle";
  const model = booking.vehicle?.model || "N/A";
  const services = formatServiceList(booking.services);
  const numericAcceptFee = Number(acceptFee) || 0;
  const fallbackMessage = [
    "New Rovauto booking request",
    `Brand: ${brand}`,
    `Model: ${model}`,
    `Services: ${services}`,
    `Open booking: ${acceptUrl}`,
  ].filter(Boolean).join("\n");

  return sendWhatsappTemplateMessage({
    to: garage.whatsappNo || garage.phone,
    templateName: GARAGE_REQUEST_TEMPLATE,
    languageCode: DEFAULT_TEMPLATE_LANGUAGE,
    parameters: [brand, model, services],
    buttons: [
      {
        subType: "url",
        index: 0,
        // The Meta template already contains the fixed URL prefix. Only send
        // the dynamic suffix represented by {{1}} in the URL button.
        parameters: [request.id],
      },
    ],
    fallbackMessage,
    context: {
      type: "garage_booking_request",
      garageId: garage.id,
      requestId: request.id,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      acceptFee: numericAcceptFee,
    },
  });
};

const sendGarageCustomerLocationWhatsapp = async ({ garage, booking }) => {
  const customerName = booking.user?.name || "Customer";
  const customerPhone = booking.user?.phone || "Phone not available";
  const location = getCustomerLocationText(booking);
  const mapsLink = getCustomerMapsLink(booking);
  const mapButtonParameter = getCustomerMapButtonParameter(booking);
  const fallbackMessage = [
    `Rovauto booking ${booking.bookingCode} accepted.`,
    `Customer: ${customerName}`,
    `Phone: ${customerPhone}`,
    `Location: ${location}`,
    `Map: ${mapsLink}`,
  ].filter(Boolean).join("\n");

  return sendWhatsappTemplateMessage({
    to: garage.whatsappNo || garage.phone,
    templateName: GARAGE_ACCEPTED_DETAILS_TEMPLATE,
    languageCode: DEFAULT_TEMPLATE_LANGUAGE,
    parameters: [customerName, customerPhone, location, mapsLink],
    buttons: [
      {
        subType: "url",
        index: 0,
        // The approved template must use this fixed URL prefix:
        // https://maps.google.com/?q={{1}}
        // Meta expects only the dynamic suffix at send time.
        parameters: [mapButtonParameter],
      },
    ],
    fallbackMessage,
    context: {
      type: "garage_customer_location",
      garageId: garage.id,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
    },
  });
};

const sendCustomerGarageDetailsWhatsapp = async ({
  customer,
  garage,
  booking,
}) => {
  const mapsLink =
    getMapsLink(garage.latitude, garage.longitude) ||
    (garage.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          garage.address,
        )}`
      : "Location not available");
  const garagePhone = garage.phone || garage.whatsappNo || "Not available";
  const garageAddress = garage.address || "Address not available";
  const mapButtonParameter = getGarageMapButtonParameter(garage);
  const message = [
    `Rovauto booking ${booking.bookingCode} confirmed.`,
    `Garage: ${garage.name}`,
    `Phone: ${garagePhone}`,
    `Address: ${garageAddress}`,
    `Garage location: ${mapsLink}`,
    "Your vehicle handover OTP has been sent to your registered email address.",
  ].join("\n");

  return sendWhatsappTemplateMessage({
    to: customer.phone,
    templateName: CUSTOMER_BOOKING_CONFIRMED_TEMPLATE,
    // This customer template is approved as plain "English" in Meta, whose
    // API language code is `en`. Garage templates continue using the shared
    // WHATSAPP_TEMPLATE_LANGUAGE value (for example `en_IN`).
    languageCode: CUSTOMER_BOOKING_CONFIRMED_LANGUAGE,
    // The approved customer template contains four body placeholders:
    // booking code, garage name, garage phone, and garage address.
    // The map value belongs only to the separate URL button parameter below.
    parameters: [
      booking.bookingCode || booking.id,
      garage.name || "Assigned garage",
      garagePhone,
      garageAddress,
    ],
    buttons: [
      {
        subType: "url",
        index: 0,
        // The approved customer template must use this fixed URL prefix:
        // https://maps.google.com/?q={{1}}
        // Meta expects only the dynamic location suffix at send time.
        parameters: [mapButtonParameter],
      },
    ],
    fallbackMessage: message,
    context: {
      type: "customer_garage_details",
      customerId: customer.id,
      garageId: garage.id,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
    },
  });
};

const sendCustomerVehicleDeliveredWhatsapp = async ({
  customer,
  garage,
  booking,
}) => {
  const trackingUrl = `${getFrontendBaseUrl()}/tracking?bookingId=${booking.id}`;
  const message = [
    `Rovauto booking ${booking.bookingCode} is ready for delivery.`,
    `${garage.name} has uploaded the post-service inspection photos and marked your vehicle delivered.`,
    "Accept delivery only after receiving and checking the vehicle.",
    `Review and accept here: ${trackingUrl}`,
  ].join("\n");

  return sendWhatsappMessage({
    to: customer.phone,
    message,
    context: {
      type: "customer_vehicle_delivered",
      customerId: customer.id,
      garageId: garage.id,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
    },
  });
};

module.exports = {
  getWhatsappAccessToken,
  getGarageAcceptUrl,
  getCustomerMapButtonParameter,
  getCustomerMapsLink,
  getMapsLink,
  getWhatsappPhoneNumberId,
  getWhatsappProviderUrl,
  isWhatsappConfigured,
  sendCustomerGarageDetailsWhatsapp,
  sendCustomerVehicleDeliveredWhatsapp,
  sendGarageBookingRequestWhatsapp,
  sendGarageCustomerLocationWhatsapp,
  sendWhatsappMessage,
  sendWhatsappTemplateMessage,
};
