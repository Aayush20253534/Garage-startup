const bookingVerificationLeadService = require("../customer/services/bookingVerificationLead.service");

const INTERVAL_MS = Math.max(
  15_000,
  Number(process.env.FIRST_BOOKING_LEAD_WORKER_INTERVAL_MS || 30_000),
);

let timer = null;
let running = false;

const runOnce = async () => {
  if (running) return;
  running = true;
  try {
    await bookingVerificationLeadService.escalateUnclaimedLeads();
  } catch (error) {
    console.error("[verification-lead-worker] run failed", error);
  } finally {
    running = false;
  }
};

const startBookingVerificationLeadWorker = () => {
  if (timer) return timer;
  void runOnce();
  timer = setInterval(() => void runOnce(), INTERVAL_MS);
  timer.unref?.();
  return timer;
};

const stopBookingVerificationLeadWorker = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};

module.exports = {
  startBookingVerificationLeadWorker,
  stopBookingVerificationLeadWorker,
};
