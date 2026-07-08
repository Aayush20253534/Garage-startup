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

const environmentOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOrigins = new Set(
  [
    /*
     * Production frontend domains.
     */
    "https://rovauto.com",
    "https://www.rovauto.com",
    "https://rovauto-d5f9c.firebaseapp.com",
    "https://rovauto-d5f9c.web.app",
    process.env.FIREBASE_HOSTING_URL,
    process.env.FIREBASE_AUTH_DOMAIN &&
      `https://${process.env.FIREBASE_AUTH_DOMAIN}`,
    process.env.VITE_FIREBASE_AUTH_DOMAIN &&
      `https://${process.env.VITE_FIREBASE_AUTH_DOMAIN}`,

    /*
     * Local Vite development.
     */
    "http://localhost:5173",
    "http://127.0.0.1:5173",

    /*
     * Optional local ports retained for your existing setup.
     */
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:8082",
    "http://127.0.0.1:8082",

    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    ...environmentOrigins,
  ]
    .map(normalizeOrigin)
    .filter(Boolean),
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

    const corsError = new Error(
      `Origin ${origin} is not allowed by CORS`,
    );

    corsError.statusCode = 403;
    corsError.status = 403;

    return callback(corsError);
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
    "Accept",
    "Origin",
  ],

  exposedHeaders: ["Content-Disposition", "Content-Length", "Content-Type"],

  optionsSuccessStatus: 204,
};

/*
 * CORS must be registered before routes.
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

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Rovauto API is running",
  });
});

app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Rovauto API is healthy",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1", routes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

app.use(errorMiddleware);

module.exports = app;
