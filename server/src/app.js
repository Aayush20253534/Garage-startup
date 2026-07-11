const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const cookieParser = require("cookie-parser");

const routes = require("./routes/index.routes");
const ApiError = require("./utils/apiError");
const errorMiddleware = require("./middlewares/error.middleware");
const {
  csrfProtection,
  getCsrfToken,
} = require("./middlewares/csrf.middleware");

const app = express();

const isProduction = process.env.NODE_ENV === "production";
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i;

/*
 * Give every request a correlation ID. Clients can share this value with
 * support while detailed failures stay in server-side logs.
 */
app.use((req, res, next) => {
  const incomingId = String(req.get("x-request-id") || "").trim();
  const requestId = /^[A-Za-z0-9_-]{8,64}$/.test(incomingId)
    ? incomingId
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
});

/*
 * Required when the backend runs behind Render or another reverse proxy.
 */
app.set("trust proxy", 1);
app.disable("x-powered-by");

/*
 * Security headers.
 */
app.use(
  helmet({
    crossOriginOpenerPolicy: {
      policy: "same-origin-allow-popups",
    },
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

const normalizeOrigin = (origin) =>
  String(origin || "")
    .trim()
    .replace(/\/+$/, "");

const configuredOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const productionOrigins = [
  "https://rovauto.com",
  "https://www.rovauto.com",
  "https://rovauto-d5f9c.firebaseapp.com",
  "https://rovauto-d5f9c.web.app",
  process.env.FIREBASE_HOSTING_URL,
  process.env.FIREBASE_AUTH_DOMAIN &&
    `https://${process.env.FIREBASE_AUTH_DOMAIN}`,
  process.env.VITE_FIREBASE_AUTH_DOMAIN &&
    `https://${process.env.VITE_FIREBASE_AUTH_DOMAIN}`,
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  ...configuredOrigins,
];

const developmentOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:8082",
  "http://127.0.0.1:8082",
];

const allowedOrigins = new Set(
  [
    ...productionOrigins,
    ...(!isProduction ? developmentOrigins : []),
  ]
    .map(normalizeOrigin)
    .filter(Boolean)
    .filter((origin) => !isProduction || !LOCAL_ORIGIN_PATTERN.test(origin)),
);

const corsOptions = {
  origin(origin, callback) {
    /*
     * Postman, mobile clients, webhooks, health checks, and other
     * server-to-server requests may not include an Origin header.
     */
    if (!origin) {
      return callback(null, true);
    }

    const normalizedRequestOrigin = normalizeOrigin(origin);

    if (allowedOrigins.has(normalizedRequestOrigin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);

    return callback(
      new ApiError(403, "This origin is not allowed to access the API"),
    );
  },

  credentials: true,

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  /*
   * Authorization was intentionally removed. Browser authentication is
   * performed with the HttpOnly cookie, not a bearer token header.
   */
  allowedHeaders: [
    "Content-Type",
    "X-Requested-With",
    "X-CSRF-Token",
    "X-Request-ID",
    "Accept",
    "Origin",
  ],

  exposedHeaders: [
    "Content-Disposition",
    "Content-Length",
    "Content-Type",
    "X-Request-ID",
  ],

  optionsSuccessStatus: 204,
};

/*
 * CORS must be registered before routes.
 */
app.use(cors(corsOptions));

app.use(compression());
app.use(cookieParser());

const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "1mb";
const URLENCODED_BODY_LIMIT = process.env.URLENCODED_BODY_LIMIT || "256kb";

app.use(
  express.json({
    limit: JSON_BODY_LIMIT,

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
    limit: URLENCODED_BODY_LIMIT,
  }),
);

app.use(csrfProtection);

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Rovauto API is running",
  });
});

app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
  });
});

app.get("/api/v1/csrf-token", getCsrfToken);

app.use("/api/v1", routes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

app.use(errorMiddleware);

module.exports = app;
