export const BOOKING_TIMELINE_STEPS = [
  {
    key: "REQUEST_SENT",
    status: "NEW",
    label: "Request Sent",
    shortLabel: "Request",
    description: "Your service request was created and sent to nearby garages.",
  },
  {
    key: "BOOKING_ACCEPTED",
    status: "ACCEPTED",
    label: "Booking Accepted",
    shortLabel: "Accepted",
    description: "A garage accepted the booking and received the service details.",
  },
  {
    key: "VEHICLE_HANDOVER",
    status: "CONFIRMED",
    label: "Vehicle Handover",
    shortLabel: "Handover",
    description: "The garage is ready to verify the handover OTP and pickup photos.",
  },
  {
    key: "SERVICE_IN_PROGRESS",
    status: "IN_PROGRESS",
    label: "Service In Progress",
    shortLabel: "Service",
    description: "Vehicle handover was verified and the garage started the service.",
  },
  {
    key: "AWAITING_CUSTOMER_ACCEPTANCE",
    status: "DELIVERED",
    label: "Awaiting Customer Acceptance",
    shortLabel: "Delivery",
    description: "The garage marked the vehicle ready. Review it and accept delivery.",
  },
  {
    key: "COMPLETED",
    status: "COMPLETED",
    label: "Completed",
    shortLabel: "Complete",
    description: "Delivery was accepted and the service is complete.",
  },
];

const getReachedIndex = (booking = {}) => {
  const status = String(booking.status || "").toUpperCase();

  if (status === "COMPLETED" || booking.customerAcceptedAt) return 5;
  if (status === "DELIVERED" || booking.deliveredAt) return 4;
  if (status === "IN_PROGRESS" || booking.handoverOtpVerifiedAt) return 3;
  if (status === "CONFIRMED") return 2;
  if (["GARAGE_ASSIGNED", "ACCEPTED"].includes(status) || booking.acceptedAt) {
    return 1;
  }

  return 0;
};

export const getBookingTimelineState = (booking = {}) => {
  const status = String(booking.status || "").toUpperCase();
  const currentIndex = getReachedIndex(booking);
  const step = BOOKING_TIMELINE_STEPS[currentIndex];
  const percent = Math.round(
    ((currentIndex + 1) / BOOKING_TIMELINE_STEPS.length) * 100,
  );

  return {
    currentIndex,
    step,
    percent,
    isCancelled: status === "CANCELLED",
    isExpired: status === "EXPIRED",
    isTerminal: ["COMPLETED", "CANCELLED", "EXPIRED"].includes(status),
    status,
  };
};
