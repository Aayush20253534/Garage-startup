const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const cookieParser = require("cookie-parser");

const routes = require("./routes/index.routes");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

/*
 * Required when the backend runs behind Render or another reverse proxy.
 */
app.set("trust proxy", 1);

/*
 * Security headers.
 */
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

/*
 * Remove trailing slashes so:
 *
 * https://www.rovauto.com
 * https://www.rovauto.com/
 *
 * are treated as the same configured origin.
 */
const normalizeOrigin = (origin) =>
  String(origin || "")
    .trim()
    .replace(/\/+$/, "");

/*
 * ALLOWED_ORIGINS may contain comma-separated URLs:
 *
 * ALLOWED_ORIGINS=https://rovauto.com,https://www.rovauto.com
 */
const environmentOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOrigins = new Set(
  [
    /*
     * Production frontend domains
     */
    "https://rovauto.com",
    "https://www.rovauto.com",
    "https://rovauto.vercel.app",

    /*
     * Local frontend development
     */
    "http://localhost:5173",
    "http://127.0.0.1:5173",

    "http://localhost:8080",
    "http://127.0.0.1:8080",

    "http://localhost:8081",
    "http://127.0.0.1:8081",

    "http://localhost:8082",
    "http://127.0.0.1:8082",

    /*
     * Environment-provided frontend URLs
     */
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,

    /*
     * Additional comma-separated origins
     */
    ...environmentOrigins,
  ]
    .map(normalizeOrigin)
    .filter(Boolean),
);

const corsOptions = {
  origin(origin, callback) {
    /*
     * Requests from Postman, mobile apps, webhooks and server-to-server
     * clients may not contain an Origin header.
     */
    if (!origin) {
      return callback(null, true);
    }

    const normalizedRequestOrigin = normalizeOrigin(origin);

    if (allowedOrigins.has(normalizedRequestOrigin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);

    const corsError = new Error(
      `Origin ${origin} is not allowed by CORS`,
    );

    corsError.statusCode = 403;
    corsError.status = 403;

    return callback(corsError);
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],

  exposedHeaders: [
    "Content-Length",
    "Content-Type",
  ],

  optionsSuccessStatus: 204,
};

/*
 * CORS must be registered before routes.
 * The cors package also handles browser preflight OPTIONS requests.
 */
app.use(cors(corsOptions));

app.use(compression());
app.use(cookieParser());

app.use(
  express.json({
    limit: "10mb",

    /*
     * Keeps the raw request body for validating webhook signatures,
     * including WhatsApp/Meta webhook signatures.
     */
    verify: (req, res, buffer) => {
      req.rawBody = buffer;
    },
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  }),
);

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

/*
 * Root route.
 */
app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Rovauto API is running",
  });
});

/*
 * Health-check route for Render and manual testing.
 */
app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Rovauto API is healthy",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

/*
 * Application routes.
 */
app.use("/api/v1", routes);

/*
 * Handle unknown routes.
 */
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

/*
 * Global error handler must remain last.
 */
app.use(errorMiddleware);

module.exports = app;