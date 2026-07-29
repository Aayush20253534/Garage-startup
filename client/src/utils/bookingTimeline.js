import { isSelfDropOffService } from "./serviceFulfillment.js";

export const BOOKING_TIMELINE_STEPS = [
  {
    key: "REQUEST_SENT",
    status: "NEW",
    label: "Request Sent",
    shortLabel: "Request",
    description: "Your service request was created and sent to eligible garages.",
  },
  {
    key: "BOOKING_ACCEPTED",
    status: "ACCEPTED",
    label: "Garage Accepted",
    shortLabel: "Accepted",
    description: "A garage accepted the booking and the service timer started.",
  },
  {
    key: "VEHICLE_HANDOVER",
    status: "CONFIRMED",
    label: "Vehicle Pickup & Handover",
    shortLabel: "Pickup",
    description: "The garage verifies the customer OTP, photos and pickup video.",
  },
  {
    key: "VEHICLE_AT_GARAGE",
    status: "AT_GARAGE",
    label: "Vehicle Reached Garage",
    shortLabel: "Garage",
    description: "The pickup journey ended at the assigned garage and service can begin.",
  },
  {
    key: "SERVICE_COMPLETED",
    status: "SERVICE_COMPLETED",
    label: "Service Completed",
    shortLabel: "Service",
    description: "Completion photos and video were uploaded and the customer was notified.",
  },
  {
    key: "VEHICLE_ARRIVED",
    status: "DELIVERED",
    label: "Vehicle Arrived",
    shortLabel: "Arrived",
    description: "The vehicle reached the customer and is ready for payment submission.",
  },
  {
    key: "PAYMENT_PENDING",
    status: "PAYMENT_PENDING",
    label: "Payment Confirmation Pending",
    shortLabel: "Payment",
    description: "The customer sent Cash or UPI payment details for garage confirmation.",
  },
  {
    key: "COMPLETED",
    status: "COMPLETED",
    label: "Completed",
    shortLabel: "Complete",
    description: "The garage confirmed payment and the customer warranty is active.",
  },
];

export const SELF_DROP_OFF_TIMELINE_STEPS = [
  {
    ...BOOKING_TIMELINE_STEPS[0],
    description: "Your self drop-off request was sent to suitable garages.",
  },
  {
    ...BOOKING_TIMELINE_STEPS[1],
    label: "Garage Assigned",
    shortLabel: "Assigned",
    description: "A garage accepted. Start the one-time live route while taking the vehicle there.",
  },
  {
    ...BOOKING_TIMELINE_STEPS[2],
    label: "Vehicle Reached Garage",
    shortLabel: "Arrival",
    description: "Garage staff confirmed arrival and recorded the before-service photos and video. No OTP is required.",
  },
  {
    ...BOOKING_TIMELINE_STEPS[3],
    label: "Service In Progress",
    shortLabel: "Service",
    description: "The vehicle is already at the garage and service work is underway.",
  },
  {
    ...BOOKING_TIMELINE_STEPS[4],
    label: "Ready for Collection",
    shortLabel: "Ready",
    description: "Completion evidence was uploaded and the vehicle is ready at the garage.",
  },
  {
    ...BOOKING_TIMELINE_STEPS[5],
    label: "Vehicle Collected",
    shortLabel: "Collected",
    description: "The customer reviewed and collected the serviced vehicle.",
  },
  BOOKING_TIMELINE_STEPS[6],
  BOOKING_TIMELINE_STEPS[7],
];

export const getBookingTimelineSteps = (booking = {}) =>
  isSelfDropOffService(booking)
    ? SELF_DROP_OFF_TIMELINE_STEPS
    : BOOKING_TIMELINE_STEPS;

const getReachedIndex = (booking = {}) => {
  const status = String(booking.status || "").toUpperCase();
  const selfDropOff = isSelfDropOffService(booking);

  if (status === "COMPLETED" || booking.finalPaymentConfirmedAt) return 7;
  if (booking.finalPaymentSubmittedAt) return 6;

  if (selfDropOff) {
    if (booking.serviceCompletedAt) return 4;
    if (booking.arrivedAtGarageAt) return 3;
    if (status === "CONFIRMED") return 1;
    if (["GARAGE_ASSIGNED", "ACCEPTED"].includes(status) || booking.acceptedAt) {
      return 1;
    }
    return 0;
  }

  if (booking.deliveredAt) return 5;
  if (booking.serviceCompletedAt) return 4;
  if (booking.arrivedAtGarageAt) return 3;
  if (booking.handoverOtpVerifiedAt || status === "IN_PROGRESS") return 2;
  if (status === "CONFIRMED") return 2;
  if (["GARAGE_ASSIGNED", "ACCEPTED"].includes(status) || booking.acceptedAt) {
    return 1;
  }

  return 0;
};

export const getBookingTimelineState = (booking = {}) => {
  const status = String(booking.status || "").toUpperCase();
  const steps = getBookingTimelineSteps(booking);
  const currentIndex = Math.min(getReachedIndex(booking), steps.length - 1);
  const step = steps[currentIndex];
  const percent = Math.round(((currentIndex + 1) / steps.length) * 100);

  return {
    currentIndex,
    step,
    steps,
    percent,
    isCancelled: status === "CANCELLED",
    isExpired: status === "EXPIRED",
    isTerminal: ["COMPLETED", "CANCELLED", "EXPIRED"].includes(status),
    status,
  };
};
