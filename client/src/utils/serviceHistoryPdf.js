const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const BOTTOM_MARGIN = 52;

const asciiText = (value = "") =>
  String(value)
    .replace(/₹/g, "INR ")
    .replace(/[–—]/g, "-")
    .replace(/→/g, " to ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapePdfText = (value) =>
  asciiText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const formatDateTime = (value) => {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};

const formatDuration = (start, end) => {
  const startTime = start ? new Date(start).getTime() : NaN;
  const endTime = end ? new Date(end).getTime() : NaN;

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return "Not recorded";
  }

  const totalMinutes = Math.max(0, Math.round((endTime - startTime) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return [
    days ? `${days} day${days === 1 ? "" : "s"}` : "",
    hours ? `${hours} hour${hours === 1 ? "" : "s"}` : "",
    `${minutes} minute${minutes === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" ");
};

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0
    ? `INR ${amount.toLocaleString("en-IN")}`
    : "Not recorded";
};

const getVehicleText = (booking) => {
  const vehicle = booking?.vehicle || {};
  return (
    `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() ||
    vehicle.registrationNumber ||
    "Saved vehicle"
  );
};

const getServices = (booking) =>
  (booking?.services || []).map((item, index) => ({
    name: item?.service?.name || `Service ${index + 1}`,
    category: item?.service?.category?.name || "",
    quantity: Number(item?.quantity || 1),
    estimatedMin: item?.estimatedMinPrice ?? item?.estimatedPrice,
    estimatedMax: item?.estimatedMaxPrice ?? item?.estimatedPrice,
    finalPrice: item?.finalPrice,
  }));

const isSelfDropOff = (booking) =>
  String(booking?.fulfillmentType || "").toUpperCase() === "SELF_DROP_OFF";

const getTimingDetails = (booking) => {
  const timings = isSelfDropOff(booking)
    ? [
        {
          label: "Home to garage",
          start: booking.acceptedAt,
          end: booking.arrivedAtGarageAt,
        },
        {
          label: "Service work",
          start: booking.arrivedAtGarageAt,
          end: booking.serviceCompletedAt,
        },
      ]
    : [
        {
          label: "Garage to customer",
          start: booking.acceptedAt,
          end: booking.handoverOtpVerifiedAt,
        },
        {
          label: "Return to garage",
          start: booking.handoverOtpVerifiedAt,
          end: booking.arrivedAtGarageAt,
        },
        {
          label: "Service work",
          start: booking.arrivedAtGarageAt,
          end: booking.serviceCompletedAt,
        },
        {
          label: "Delivery to customer",
          start: booking.serviceCompletedAt,
          end: booking.deliveredAt,
        },
      ];

  timings.push(
    {
      label: "Payment confirmation",
      start: booking.finalPaymentSubmittedAt,
      end: booking.finalPaymentConfirmedAt,
    },
    {
      label: "Total booking time",
      start: booking.acceptedAt,
      end: booking.finalPaymentConfirmedAt || booking.customerAcceptedAt,
    },
  );

  return timings;
};

const wrapText = (text, fontSize = 10, indent = 0) => {
  const normalized = asciiText(text) || "-";
  const approximateCharacterWidth = Math.max(fontSize * 0.53, 4.5);
  const maximumCharacters = Math.max(
    18,
    Math.floor((CONTENT_WIDTH - indent) / approximateCharacterWidth),
  );
  const words = normalized.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= maximumCharacters) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
};

const createDocumentLines = (booking) => {
  const customer = booking?.user || {};
  const vehicle = booking?.vehicle || {};
  const garage = booking?.garage || {};
  const payment = booking?.payment || {};
  const services = getServices(booking);
  const timings = getTimingDetails(booking);
  const inspectionMedia = booking?.inspectionImages || [];
  const pickupPhotos = inspectionMedia.filter(
    (item) => item.phase === "PICKUP" && item.mediaType !== "VIDEO",
  ).length;
  const pickupVideos = inspectionMedia.filter(
    (item) => item.phase === "PICKUP" && item.mediaType === "VIDEO",
  ).length;
  const deliveryPhotos = inspectionMedia.filter(
    (item) => item.phase === "DELIVERY" && item.mediaType !== "VIDEO",
  ).length;
  const deliveryVideos = inspectionMedia.filter(
    (item) => item.phase === "DELIVERY" && item.mediaType === "VIDEO",
  ).length;

  const lines = [];
  const title = (text) => lines.push({ text, size: 18, bold: true, gapAfter: 8 });
  const section = (text) =>
    lines.push({ text, size: 12, bold: true, gapBefore: 10, gapAfter: 4 });
  const row = (label, value) =>
    lines.push({ text: `${label}: ${value || "Not recorded"}`, size: 9.5 });
  const paragraph = (text) => lines.push({ text, size: 9.5, gapAfter: 2 });

  title("ROVAUTO SERVICE HISTORY REPORT");
  row("Booking reference", booking?.bookingCode || booking?.id);
  row("Status", booking?.status || "COMPLETED");
  row("Fulfilment", isSelfDropOff(booking) ? "Self drop-off and pickup" : "Pickup and delivery");
  row("Created", formatDateTime(booking?.createdAt));
  row(
    "Completed",
    formatDateTime(
      booking?.finalPaymentConfirmedAt ||
        booking?.customerAcceptedAt ||
        booking?.updatedAt,
    ),
  );

  section("CUSTOMER");
  row("Name", customer.name);
  row("Phone", customer.phone);
  row("Email", customer.email);
  row("Service address", booking?.customerAddress);

  section("VEHICLE");
  row("Vehicle", getVehicleText(booking));
  row("Registration", vehicle.registrationNumber);
  row("Fuel type", vehicle.fuelType);
  row("Scheduled date", formatDateTime(booking?.scheduledDate));
  row("Requested slot", [booking?.startTime, booking?.endTime].filter(Boolean).join(" - "));

  section("GARAGE");
  row("Garage", garage.name || "Auto-assigned garage");
  row("Phone", garage.phone || garage.whatsappNo);
  row("Address", garage.address);

  section("SERVICES");
  if (services.length === 0) {
    paragraph("Vehicle service");
  } else {
    services.forEach((service, index) => {
      const estimatedRange =
        service.estimatedMin || service.estimatedMax
          ? `${formatMoney(service.estimatedMin)} - ${formatMoney(
              service.estimatedMax || service.estimatedMin,
            )}`
          : "Not recorded";
      paragraph(
        `${index + 1}. ${service.name}${service.category ? ` (${service.category})` : ""} | Quantity: ${service.quantity} | Estimated: ${estimatedRange} | Final: ${formatMoney(service.finalPrice)}`,
      );
    });
  }
  row("Total estimated minimum", formatMoney(booking?.totalServiceAmount));
  row("Total estimated maximum", formatMoney(booking?.totalServiceMaxAmount));
  row("Final service amount", formatMoney(booking?.finalPaymentAmount || booking?.totalServiceAmount));

  section("PAYMENT");
  row("Platform payment status", payment.status);
  row("Platform amount", formatMoney(payment.amount || booking?.payableAmount));
  row("Wallet used", formatMoney(payment.walletAmountUsed || booking?.walletAmountUsed));
  row("Final payment method", booking?.finalPaymentMethod);
  row("Final payment amount", formatMoney(booking?.finalPaymentAmount));
  row("Payment submitted", formatDateTime(booking?.finalPaymentSubmittedAt));
  row("Payment confirmed", formatDateTime(booking?.finalPaymentConfirmedAt));

  section("DETAILED TIMELINE");
  timings.forEach((item, index) => {
    paragraph(
      `${index + 1}. ${item.label} | Duration: ${formatDuration(item.start, item.end)} | Start: ${formatDateTime(item.start)} | End: ${formatDateTime(item.end)}`,
    );
  });

  section("INSPECTION EVIDENCE");
  row("Pickup or drop-off photos", pickupPhotos);
  row("Pickup or drop-off videos", pickupVideos);
  row("Post-service or delivery photos", deliveryPhotos);
  row("Post-service or delivery videos", deliveryVideos);

  section("REVIEW AND NOTES");
  row("Rating", booking?.review?.rating ? `${booking.review.rating} / 5` : "Not rated");
  row("Review", booking?.review?.comment);
  row("Customer note", booking?.customerNote);
  row("Garage note", booking?.garageNote);

  lines.push({
    text: "This report is generated from the booking records available in Rovauto.",
    size: 8,
    gapBefore: 14,
  });

  return lines;
};

const paginateLines = (lines) => {
  const pages = [];
  let page = [];
  let y = PAGE_HEIGHT - PAGE_MARGIN - 22;

  const pushPage = () => {
    if (page.length > 0) pages.push(page);
    page = [];
    y = PAGE_HEIGHT - PAGE_MARGIN - 22;
  };

  for (const item of lines) {
    const size = item.size || 10;
    const leading = size + 4;
    const wrappedLines = wrapText(item.text, size, item.indent || 0);
    const requiredHeight =
      (item.gapBefore || 0) +
      wrappedLines.length * leading +
      (item.gapAfter || 0);

    if (y - requiredHeight < BOTTOM_MARGIN && page.length > 0) {
      pushPage();
    }

    y -= item.gapBefore || 0;

    wrappedLines.forEach((line) => {
      page.push({
        text: line,
        x: PAGE_MARGIN + (item.indent || 0),
        y,
        size,
        bold: Boolean(item.bold),
      });
      y -= leading;
    });

    y -= item.gapAfter || 0;
  }

  pushPage();
  return pages.length > 0 ? pages : [[]];
};

const buildContentStream = (pageLines, pageNumber, pageCount, generatedAt) => {
  const commands = ["0 G", "0 g"];

  commands.push(
    `BT /F1 8 Tf ${PAGE_MARGIN} ${PAGE_HEIGHT - 28} Td (Rovauto - Service History) Tj ET`,
  );
  commands.push(
    `BT /F1 8 Tf ${PAGE_MARGIN} 26 Td (Generated ${escapePdfText(formatDateTime(generatedAt))}) Tj ET`,
  );
  commands.push(
    `BT /F1 8 Tf ${PAGE_WIDTH - PAGE_MARGIN - 58} 26 Td (Page ${pageNumber} of ${pageCount}) Tj ET`,
  );
  commands.push(
    `${PAGE_MARGIN} ${PAGE_HEIGHT - 36} m ${PAGE_WIDTH - PAGE_MARGIN} ${PAGE_HEIGHT - 36} l S`,
  );
  commands.push(
    `${PAGE_MARGIN} 38 m ${PAGE_WIDTH - PAGE_MARGIN} 38 l S`,
  );

  pageLines.forEach((line) => {
    const font = line.bold ? "/F2" : "/F1";
    commands.push(
      `BT ${font} ${line.size} Tf ${line.x} ${line.y} Td (${escapePdfText(line.text)}) Tj ET`,
    );
  });

  return commands.join("\n");
};

const createPdf = (pages, generatedAt) => {
  const objects = [];
  const catalogId = 1;
  const pagesId = 2;
  const regularFontId = 3;
  const boldFontId = 4;
  const pageObjectIds = [];
  const contentObjectIds = [];

  pages.forEach((_, index) => {
    pageObjectIds.push(5 + index * 2);
    contentObjectIds.push(6 + index * 2);
  });

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] >>`;
  objects[regularFontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[boldFontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  pages.forEach((pageLines, index) => {
    const pageId = pageObjectIds[index];
    const contentId = contentObjectIds[index];
    const stream = buildContentStream(
      pageLines,
      index + 1,
      pages.length,
      generatedAt,
    );

    objects[pageId] =
      `<< /Type /Page /Parent ${pagesId} 0 R ` +
      `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> ` +
      `/Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf +=
    `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
};

export const buildServiceHistoryPdfBytes = (
  booking,
  generatedAt = new Date(),
) => {
  const pages = paginateLines(createDocumentLines(booking || {}));
  return createPdf(pages, generatedAt);
};

export const downloadServiceHistoryPdf = (booking) => {
  const bytes = buildServiceHistoryPdfBytes(booking);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const reference = asciiText(booking?.bookingCode || booking?.id || "booking")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  anchor.href = url;
  anchor.download = `Rovauto-Service-History-${reference || "booking"}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
