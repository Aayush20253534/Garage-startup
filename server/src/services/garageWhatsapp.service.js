const axios = require("axios");
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
    errorType: data.error?.type,
    errorMessage: data.error?.message,
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
  const numericAcceptFee = Number(acceptFee) || 0;
  const message = [
    "New Rovauto booking request",
    `Brand: ${booking.vehicle?.brand || "Vehicle"}`,
    `Model: ${booking.vehicle?.model || "N/A"}`,
    `Services: ${formatServiceList(booking.services)}`,
    `Amount: ${formatBookingAmount(booking)}`,
    numericAcceptFee > 0
      ? `Garage accept fee: Rs. ${numericAcceptFee.toLocaleString("en-IN")}`
      : null,
    numericAcceptFee > 0
      ? "Recharge wallet before accepting if your balance is low."
      : null,
    `Accept here: ${acceptUrl}`,
  ].filter(Boolean).join("\n");

  return sendWhatsappMessage({
    to: garage.whatsappNo || garage.phone,
    message,
    context: {
      type: "garage_booking_request",
      garageId: garage.id,
      requestId: request.id,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
    },
  });
};

const sendGarageCustomerLocationWhatsapp = async ({ garage, booking }) => {
  const mapsLink = getMapsLink(
    booking.customerLatitude,
    booking.customerLongitude,
  );
  const message = [
    `Rovauto booking ${booking.bookingCode} accepted.`,
    `Customer: ${booking.user?.name || "Customer"}`,
    booking.user?.phone ? `Phone: ${booking.user.phone}` : null,
    booking.customerAddress ? `Address: ${booking.customerAddress}` : null,
    `Vehicle: ${formatVehicleDetails(booking.vehicle)}`,
    `Services: ${formatServiceList(booking.services)}`,
    mapsLink ? `Customer location: ${mapsLink}` : null,
  ].filter(Boolean).join("\n");

  return sendWhatsappMessage({
    to: garage.whatsappNo || garage.phone,
    message,
    context: {
      type: "garage_customer_location",
      garageId: garage.id,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
    },
  });
};

const formatOtpExpiry = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.APP_TIME_ZONE || "Asia/Kolkata",
  });
};

const sendCustomerGarageDetailsWhatsapp = async ({
  customer,
  garage,
  booking,
}) => {
  const mapsLink = getMapsLink(garage.latitude, garage.longitude);
  const message = [
    `Rovauto booking ${booking.bookingCode} confirmed.`,
    `Garage: ${garage.name}`,
    `Phone: ${garage.phone}`,
    garage.address ? `Address: ${garage.address}` : null,
    mapsLink ? `Garage location: ${mapsLink}` : null,
    "Your handover OTP will arrive in a separate WhatsApp message.",
  ].filter(Boolean).join("\n");

  return sendWhatsappMessage({
    to: customer.phone,
    message,
    context: {
      type: "customer_garage_details",
      customerId: customer.id,
      garageId: garage.id,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
    },
  });
};

const sendCustomerHandoverOtpWhatsapp = async ({
  customer,
  garage,
  booking,
  otp,
  otpExpiresAt,
  isRegenerated = false,
}) => {
  if (!otp) return { sent: false, reason: "missing_otp" };

  const otpExpiry = formatOtpExpiry(otpExpiresAt);
  const message = [
    isRegenerated
      ? `New handover OTP for Rovauto booking ${booking.bookingCode}.`
      : `Vehicle handover OTP for Rovauto booking ${booking.bookingCode}.`,
    `OTP: ${otp}`,
    otpExpiry ? `Valid until: ${otpExpiry}` : null,
    garage?.name
      ? `Use this only while handing your vehicle to ${garage.name}.`
      : "Use this only while handing over your vehicle.",
    "Do not share this OTP before physical vehicle handover.",
  ].filter(Boolean).join("\n");

  return sendWhatsappMessage({
    to: customer.phone,
    message,
    context: {
      type: "customer_handover_otp",
      customerId: customer.id,
      garageId: garage?.id,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      isRegenerated,
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
  getMapsLink,
  getWhatsappPhoneNumberId,
  getWhatsappProviderUrl,
  sendCustomerGarageDetailsWhatsapp,
  sendCustomerHandoverOtpWhatsapp,
  sendCustomerVehicleDeliveredWhatsapp,
  sendGarageBookingRequestWhatsapp,
  sendGarageCustomerLocationWhatsapp,
  sendWhatsappMessage,
};
