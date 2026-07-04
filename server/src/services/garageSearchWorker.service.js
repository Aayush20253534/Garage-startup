const prisma = require("../config/prisma");
const garageRequestService = require("./garageRequest.service");

const DEFAULT_WORKER_INTERVAL_MS = 10 * 1000;
const DEFAULT_WORKER_BATCH_SIZE = 100;

let workerTimer = null;
let workerRunning = false;

const getWorkerIntervalMs = () => {
  const configured = Number(
    process.env.GARAGE_SEARCH_WORKER_INTERVAL_MS ||
      DEFAULT_WORKER_INTERVAL_MS,
  );

  return Number.isFinite(configured) && configured >= 5000
    ? configured
    : DEFAULT_WORKER_INTERVAL_MS;
};

const runGarageSearchWorkerOnce = async () => {
  if (workerRunning) return;
  workerRunning = true;

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: "SEARCHING_GARAGE",
        garageId: null,
      },
      select: { id: true },
      orderBy: { updatedAt: "asc" },
      take: DEFAULT_WORKER_BATCH_SIZE,
    });

    for (const booking of bookings) {
      try {
        await garageRequestService.ensureBookingSearchActive(booking.id);
      } catch (error) {
        console.error(
          `[garage-search-worker] booking ${booking.id}:`,
          error.message,
        );
      }
    }
  } finally {
    workerRunning = false;
  }
};

const startGarageSearchWorker = () => {
  if (workerTimer) return workerTimer;

  runGarageSearchWorkerOnce().catch((error) => {
    console.error("[garage-search-worker] initial run failed:", error.message);
  });

  workerTimer = setInterval(() => {
    runGarageSearchWorkerOnce().catch((error) => {
      console.error("[garage-search-worker] run failed:", error.message);
    });
  }, getWorkerIntervalMs());

  if (typeof workerTimer.unref === "function") {
    workerTimer.unref();
  }

  return workerTimer;
};

const stopGarageSearchWorker = () => {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
};

module.exports = {
  runGarageSearchWorkerOnce,
  startGarageSearchWorker,
  stopGarageSearchWorker,
};
