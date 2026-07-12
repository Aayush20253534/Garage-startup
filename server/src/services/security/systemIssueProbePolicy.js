const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const FORBIDDEN_ENDPOINT_CHARACTERS = /[\\\u0000-\u001f\u007f]/;
const RESERVED_METADATA_KEY_PATTERN = /^autoResolveProbeUrl$/i;

const normalizeBaseUrl = (value) => {
  try {
    const baseUrl = new URL(String(value || "").trim());

    if (!ALLOWED_PROTOCOLS.has(baseUrl.protocol)) return null;
    if (baseUrl.username || baseUrl.password) return null;

    baseUrl.search = "";
    baseUrl.hash = "";
    baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, "") || "/";

    return baseUrl;
  } catch {
    return null;
  }
};

const getBasePath = (baseUrl) =>
  baseUrl.pathname === "/" ? "" : baseUrl.pathname;

const isPathInsideBase = (pathname, basePath) =>
  !basePath ||
  pathname === basePath ||
  pathname.startsWith(`${basePath}/`);

const isReservedSystemIssueMetadataKey = (key) =>
  RESERVED_METADATA_KEY_PATTERN.test(String(key || ""));

const isUntrustedPublicIssue = (issue) =>
  String(issue?.actorType || "PUBLIC").toUpperCase() === "PUBLIC" &&
  !issue?.userId;

const buildSafeProbeUrl = ({ endpoint, baseUrl }) => {
  const rawEndpoint = String(endpoint || "").trim();
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (!rawEndpoint || !normalizedBaseUrl) return null;
  if (FORBIDDEN_ENDPOINT_CHARACTERS.test(rawEndpoint)) return null;
  if (rawEndpoint.startsWith("//")) return null;

  const basePath = getBasePath(normalizedBaseUrl);
  let candidate;

  try {
    if (/^[a-z][a-z\d+.-]*:/i.test(rawEndpoint)) {
      candidate = new URL(rawEndpoint);
    } else {
      const endpointPath = rawEndpoint.split(/[?#]/, 1)[0];
      if (!endpointPath) return null;

      const normalizedEndpointPath = endpointPath.startsWith("/")
        ? endpointPath
        : `/${endpointPath}`;

      const targetPath = isPathInsideBase(normalizedEndpointPath, basePath)
        ? normalizedEndpointPath
        : `${basePath}${normalizedEndpointPath}`;

      candidate = new URL(targetPath || "/", normalizedBaseUrl.origin);
    }
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.has(candidate.protocol)) return null;
  if (candidate.username || candidate.password) return null;
  if (candidate.origin !== normalizedBaseUrl.origin) return null;
  if (!isPathInsideBase(candidate.pathname, basePath)) return null;

  // Probes verify route health only. Never replay client-controlled query strings
  // or fragments because they can select expensive or stateful behavior.
  candidate.search = "";
  candidate.hash = "";

  return candidate.toString();
};

module.exports = {
  buildSafeProbeUrl,
  isReservedSystemIssueMetadataKey,
  isUntrustedPublicIssue,
};
