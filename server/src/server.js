require("dotenv/config");

const { validateEnvironment } = require("./config/env");

validateEnvironment();

const app = require("./app");
const prisma = require("./config/prisma");
const redis = require("./config/redis");
const systemIssueReporter = require("./services/systemIssueReporter.service");
const {
  startGarageSearchWorker,
  stopGarageSearchWorker,
} = require("./services/garageSearchWorker.service");
const {
  startSystemIssueAutoResolver,
  stopSystemIssueAutoResolver,
} = require("./services/systemIssueAutoResolver.service");
const {
  startGarageApplicationEmailOutboxWorker,
  stopGarageApplicationEmailOutboxWorker,
} = require("./garage/services/applicationEmailOutbox.service");
const {
  startSessionRetentionCleanup,
  stopSessionRetentionCleanup,
} = require("./services/sessionRetention.service");
const {
  startBookingVerificationLeadWorker,
  stopBookingVerificationLeadWorker,
} = require("./services/bookingVerificationLeadWorker.service");

const PORT = process.env.PORT || 5000;
const SHUTDOWN_TIMEOUT_MS = Math.max(
  5_000,
  Number(process.env.SHUTDOWN_TIMEOUT_MS || 15_000),
);
const FAILURE_REPORT_TIMEOUT_MS = Math.max(
  500,
  Number(process.env.FAILURE_REPORT_TIMEOUT_MS || 3_000),
);

let server = null;
let shuttingDown = false;

const withTimeout = (promise, timeoutMs, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
      timer.unref?.();
    }),
  ]);

const reportProcessFailure = async (error, title, severity = "CRITICAL") => {
  console.error(title, error);

  try {
    await withTimeout(
      systemIssueReporter.captureBackgroundError(error, {
        title,
        component: "Node.js process",
        severity,
      }),
      FAILURE_REPORT_TIMEOUT_MS,
      "Process failure report",
    );
  } catch (reportError) {
    console.error("Failed to persist process failure report:", reportError.message);
  }
};

const closeHttpServer = async () => {
  if (!server) return;

  server.closeIdleConnections?.();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
};

const closeRedis = async () => {
  if (!redis || ["end", "close"].includes(redis.status)) return;

  try {
    await withTimeout(redis.quit(), 2_000, "Redis shutdown");
  } catch (error) {
    console.error("Redis graceful shutdown failed:", error.message);
    redis.disconnect(false);
  }
};

const shutdown = async ({ signal, exitCode = 0, error = null }) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received. Shutting down...`);
  if (error) {
    await reportProcessFailure(
      error,
      signal === "unhandledRejection"
        ? "Unhandled promise rejection"
        : "Uncaught server exception",
      signal === "unhandledRejection" ? "ERROR" : "CRITICAL",
    );
  }

  stopGarageSearchWorker();
  stopSystemIssueAutoResolver();
  stopGarageApplicationEmailOutboxWorker();
  stopSessionRetentionCleanup();
  stopBookingVerificationLeadWorker();

  const forceExitTimer = setTimeout(() => {
    console.error(`Forced shutdown after ${SHUTDOWN_TIMEOUT_MS}ms`);
    server?.closeAllConnections?.();
    process.exit(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref?.();

  const results = await Promise.allSettled([
    closeHttpServer(),
    prisma.$disconnect(),
    closeRedis(),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Shutdown task failed:", result.reason);
      exitCode = exitCode || 1;
    }
  }

  clearTimeout(forceExitTimer);
  process.exit(exitCode);
};

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  void shutdown({ signal: "unhandledRejection", exitCode: 1, error });
});

process.on("uncaughtException", (error) => {
  void shutdown({ signal: "uncaughtException", exitCode: 1, error });
});

process.on("SIGTERM", () => {
  void shutdown({ signal: "SIGTERM" });
});

process.on("SIGINT", () => {
  void shutdown({ signal: "SIGINT" });
});

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("Database connected successfully");

    startGarageSearchWorker();
    const systemIssueAutoResolver = startSystemIssueAutoResolver();
    startGarageApplicationEmailOutboxWorker();
    startSessionRetentionCleanup();
    startBookingVerificationLeadWorker();

    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log("Garage search worker started");
      console.log("Garage application email outbox worker started");
      console.log("First-booking verification lead worker started");
      console.log(
        systemIssueAutoResolver
          ? "System issue auto resolver started"
          : "System issue auto resolver disabled",
      );
    });

    server.on("error", (error) => {
      void shutdown({ signal: "serverError", exitCode: 1, error });
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    await reportProcessFailure(error, "Server startup failed");

    await Promise.allSettled([prisma.$disconnect(), closeRedis()]);
    process.exit(1);
  }
};

void startServer();
