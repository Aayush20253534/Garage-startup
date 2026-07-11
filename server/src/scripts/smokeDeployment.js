require("dotenv").config();

const apiValue = String(
  process.env.SMOKE_API_URL ||
    process.env.PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    "",
).trim();
const frontendValue = String(
  process.env.SMOKE_FRONTEND_URL ||
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    "",
).trim();

if (!apiValue || !frontendValue) {
  throw new Error("Set SMOKE_API_URL/PUBLIC_API_URL and SMOKE_FRONTEND_URL/FRONTEND_URL");
}

const apiOrigin = new URL(apiValue).origin;
const frontendUrl = new URL(frontendValue).toString();
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

const check = async (name, url, expectedStatuses = [200]) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json,text/html" },
      redirect: "follow",
    });

    if (!expectedStatuses.includes(response.status)) {
      throw new Error(`${name} returned HTTP ${response.status}`);
    }

    return { name, url, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
};

(async () => {
  const results = [];
  results.push(await check("API health", `${apiOrigin}/health`));
  results.push(await check("CSRF token", `${apiOrigin}/api/v1/csrf-token`));
  results.push(await check("Frontend", frontendUrl));

  console.log(JSON.stringify({
    success: true,
    checkedAt: new Date().toISOString(),
    results,
  }, null, 2));
})().catch((error) => {
  console.error("Deployment smoke test failed:", error.message);
  process.exitCode = 1;
});
