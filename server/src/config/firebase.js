const {
  cert,
  getApps,
  initializeApp,
} = require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");

const jwt = require("jsonwebtoken");
const ApiError = require("../utils/apiError");

const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedFirebaseCerts = null;
let cachedFirebaseCertsExpiresAt = 0;

const cleanEnv = (value) => {
  return String(value || "")
    .trim()
    .replace(/^"|"$/g, "");
};

const getPrivateKey = () => {
  const key = cleanEnv(process.env.FIREBASE_PRIVATE_KEY);

  return key ? key.replace(/\\n/g, "\n") : "";
};

const decodeJwtPayload = (token) => {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new ApiError(400, "Firebase ID token is malformed");
  }

  try {
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const paddedPayload = payload.padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      "=",
    );

    return JSON.parse(
      Buffer.from(paddedPayload, "base64").toString("utf8"),
    );
  } catch {
    throw new ApiError(
      400,
      "Firebase ID token payload is malformed",
    );
  }
};

const decodeJwtHeader = (token) => {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new ApiError(400, "Firebase ID token is malformed");
  }

  try {
    const header = parts[0]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const paddedHeader = header.padEnd(
      header.length + ((4 - (header.length % 4)) % 4),
      "=",
    );

    return JSON.parse(
      Buffer.from(paddedHeader, "base64").toString("utf8"),
    );
  } catch {
    throw new ApiError(
      400,
      "Firebase ID token header is malformed",
    );
  }
};

const getFirebasePublicCerts = async () => {
  if (
    cachedFirebaseCerts &&
    Date.now() < cachedFirebaseCertsExpiresAt
  ) {
    return cachedFirebaseCerts;
  }

  const response = await fetch(FIREBASE_CERTS_URL);

  if (!response.ok) {
    throw new ApiError(
      502,
      "Could not fetch Firebase public certificates",
    );
  }

  const cacheControl =
    response.headers.get("cache-control") || "";

  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);

  const maxAgeSeconds = maxAgeMatch
    ? Number(maxAgeMatch[1])
    : 3600;

  cachedFirebaseCerts = await response.json();

  cachedFirebaseCertsExpiresAt =
    Date.now() + maxAgeSeconds * 1000;

  return cachedFirebaseCerts;
};

const verifyFirebaseIdTokenWithPublicCerts = async (
  token,
  projectId,
) => {
  const header = decodeJwtHeader(token);

  if (header.alg !== "RS256") {
    throw new ApiError(
      401,
      "Firebase ID token uses an invalid algorithm",
    );
  }

  if (!header.kid) {
    throw new ApiError(
      401,
      "Firebase ID token does not contain a key id",
    );
  }

  const certs = await getFirebasePublicCerts();
  const publicCertificate = certs[header.kid];

  if (!publicCertificate) {
    throw new ApiError(
      401,
      "Firebase ID token has an unknown key id",
    );
  }

  try {
    return jwt.verify(token, publicCertificate, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    });
  } catch (error) {
    throw new ApiError(
      401,
      `Firebase ID token verification failed: ${error.message}`,
    );
  }
};

const getFirebaseConfig = () => {
  const projectId = cleanEnv(
    process.env.FIREBASE_PROJECT_ID,
  );

  const clientEmail = cleanEnv(
    process.env.FIREBASE_CLIENT_EMAIL,
  );

  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new ApiError(
      503,
      "Firebase authentication is not configured",
    );
  }

  if (
    !privateKey.includes(
      "-----BEGIN PRIVATE KEY-----",
    ) ||
    !privateKey.includes(
      "-----END PRIVATE KEY-----",
    )
  ) {
    throw new ApiError(
      503,
      "Firebase private key is invalid. Paste the full private_key value with \\n characters.",
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
};

const getFirebaseApp = () => {
  const existingApps = getApps();

  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const {
    projectId,
    clientEmail,
    privateKey,
  } = getFirebaseConfig();

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  } catch (error) {
    throw new ApiError(
      503,
      `Firebase authentication configuration is invalid: ${error.message}`,
    );
  }
};

const verifyFirebaseIdToken = async (idToken) => {
  const token =
    typeof idToken === "string"
      ? idToken.trim()
      : "";

  const projectId = cleanEnv(
    process.env.FIREBASE_PROJECT_ID,
  );

  if (!token) {
    throw new ApiError(
      400,
      "Firebase ID token is required",
    );
  }

  const decodedPayload = decodeJwtPayload(token);

  if (
    projectId &&
    decodedPayload.aud !== projectId
  ) {
    throw new ApiError(
      401,
      `Firebase project mismatch. Token project is "${decodedPayload.aud}", backend FIREBASE_PROJECT_ID is "${projectId}".`,
    );
  }

  try {
    const firebaseApp = getFirebaseApp();

    return await getAuth(firebaseApp).verifyIdToken(
      token,
    );
  } catch (error) {
    if (
      error.statusCode &&
      error.statusCode !== 503
    ) {
      throw error;
    }

    console.error(
      "Firebase Admin ID token verification failed; trying public cert fallback",
      {
        code: error.code,
        message: error.message,
        tokenProject: decodedPayload.aud,
        tokenIssuer: decodedPayload.iss,
        backendProject: projectId,
      },
    );

    if (projectId) {
      return verifyFirebaseIdTokenWithPublicCerts(
        token,
        projectId,
      );
    }

    throw new ApiError(
      401,
      "Firebase ID token verification failed",
    );
  }
};

module.exports = {
  getFirebaseApp,
  verifyFirebaseIdToken,
};