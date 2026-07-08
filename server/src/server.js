require("dotenv/config");

const app = require("./app");
const prisma = require("./config/prisma");
const systemIssueReporter = require("./services/systemIssueReporter.service");
const {
  startGarageSearchWorker,
  stopGarageSearchWorker,
} = require("./services/garageSearchWorker.service");
const {
  startSystemIssueAutoResolver,
  stopSystemIssueAutoResolver,
} = require("./services/systemIssueAutoResolver.service");

const PORT = process.env.PORT || 5000;

const reportProcessFailure = async (error, title, severity = "CRITICAL") => {
  console.error(title, error);
  await systemIssueReporter.captureBackgroundError(error, {
    title,
    component: "Node.js process",
    severity,
  });
};

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  void reportProcessFailure(error, "Unhandled promise rejection", "ERROR");
});

process.on("uncaughtException", async (error) => {
  await reportProcessFailure(error, "Uncaught server exception");
  process.exit(1);
});


const startServer = async () => {
  try {
    await prisma.$connect();

    console.log("Database connected successfully");

    /*
     * Starts the recurring garage-search worker.
     *
     * The worker checks bookings whose two-minute search round has expired
     * and sends the next batch of requests to nearby garages.
     *
     * Start it only after the database connection succeeds.
     */
    startGarageSearchWorker();
    const systemIssueAutoResolver = startSystemIssueAutoResolver();

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log("Garage search worker started");
      console.log(
        systemIssueAutoResolver
          ? "System issue auto resolver started"
          : "System issue auto resolver disabled",
      );
    });

    /*
     * Graceful shutdown.
     * This closes the HTTP server and Prisma connection when the process
     * receives a shutdown signal from Render, Docker, or the operating system.
     */
    const shutdown = async (signal) => {
      console.log(`${signal} received. Shutting down gracefully...`);
      stopGarageSearchWorker();
      stopSystemIssueAutoResolver();

      server.close(async () => {
        try {
          await prisma.$disconnect();
          console.log("Database disconnected successfully");
          process.exit(0);
        } catch (error) {
          console.error("Failed to disconnect database:", error);
          process.exit(1);
        }
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start server:", error);
    await systemIssueReporter.captureBackgroundError(error, {
      title: "Server startup failed",
      component: "Server startup",
      severity: "CRITICAL",
    });

    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Failed to disconnect Prisma:", disconnectError);
    }

    process.exit(1);
  }
};

startServer();
