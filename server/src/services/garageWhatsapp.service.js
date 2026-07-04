const axios = require("axios");
const { createWhatsappLink, normalizeWhatsappNumber } = require("../utils/whatsapp");

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

const getFrontendBaseUrl = () => (process.env.FRONTEND_URL || process.env.CLIENT_URL || "https://rovauto.vercel.app").replace(/\/+$/, "");

const getGarageAcceptUrl = (requestId) => {
  const acceptPath = process.env.GARAGE_REQUEST_ACCEPT_PATH || "/garage/magic";
  return `${getFrontendBaseUrl()}${acceptPath}/${requestId}`;
};

const getMapsLink = (latitude, longitude) => {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null;
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
};

const sendWhatsappMessage = async ({ to, message }) => {
  const phone = normalizeWhatsappNumber(to);
  if (!phone || !message) return { sent: false, reason: "missing_phone_or_message" };

  if (!isWhatsappConfigured()) {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[whatsapp:log] to=${phone} ${message}`);
    }
    return { sent: false, logged: true, whatsappLink: createWhatsappLink(phone, message) };
  }

  const providerUrl = getWhatsappProviderUrl();
  const accessToken = getWhatsappAccessToken();
  const payload = isMetaCloudApiUrl(providerUrl)
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

  const response = await axios.post(providerUrl, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return { sent: true, providerResponse: response.data };
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

const sendGarageBookingRequestWhatsapp = async ({ garage, request, booking }) => {
  const acceptUrl = getGarageAcceptUrl(request.id);
  const message = [
    "New Rovauto booking request",
    `Brand: ${booking.vehicle?.brand || "Vehicle"}`,
    `Model: ${booking.vehicle?.model || "N/A"}`,
    `Services: ${formatServiceList(booking.services)}`,
    `Amount: ${formatBookingAmount(booking)}`,
    `Accept here: ${acceptUrl}`,
  ].filter(Boolean).join("\n");

  return sendWhatsappMessage({ to: garage.whatsappNo || garage.phone, message });
};

const sendGarageCustomerLocationWhatsapp = async ({ garage, booking }) => {
  const mapsLink = getMapsLink(booking.customerLatitude, booking.customerLongitude);
  const message = [
    `Rovauto booking ${booking.bookingCode} accepted.`,
    `Customer: ${booking.user?.name || "Customer"}`,
    `Vehicle: ${formatVehicleDetails(booking.vehicle)}`,
    mapsLink ? `Customer location: ${mapsLink}` : null,
  ].filter(Boolean).join("\n");

  return sendWhatsappMessage({ to: garage.whatsappNo || garage.phone, message });
};

const sendCustomerGarageDetailsWhatsapp = async ({ customer, garage, booking }) => {
  const mapsLink = getMapsLink(garage.latitude, garage.longitude);
  const message = [
    `Rovauto booking ${booking.bookingCode} confirmed.`,
    `Garage: ${garage.name}`,
    `Phone: ${garage.phone}`,
    garage.address ? `Address: ${garage.address}` : null,
    mapsLink ? `Garage location: ${mapsLink}` : null,
  ].filter(Boolean).join("\n");

  return sendWhatsappMessage({ to: customer.phone, message });
};

module.exports = {
  getWhatsappAccessToken,
  getGarageAcceptUrl,
  getMapsLink,
  getWhatsappPhoneNumberId,
  getWhatsappProviderUrl,
  sendCustomerGarageDetailsWhatsapp,
  sendGarageBookingRequestWhatsapp,
  sendGarageCustomerLocationWhatsapp,
  sendWhatsappMessage,
};
