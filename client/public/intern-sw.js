const LEGACY_IMAGE_CACHE_PREFIX = "rovauto-intern-cloudinary-images-";
const OFFLINE_URL = "/offline.html";
const SHELL_CACHE_PREFIX = "rovauto-intern-shell-";
const SHELL_CACHE = "rovauto-intern-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        cache.add(new Request(OFFLINE_URL, { cache: "reload" })),
      )
      .catch(() => null)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(LEGACY_IMAGE_CACHE_PREFIX) ||
                (key.startsWith(SHELL_CACHE_PREFIX) && key !== SHELL_CACHE),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/*
 * Cloudinary images deliberately bypass the service-worker Cache API.
 * Cross-origin no-cors responses are opaque, so a temporary error response
 * cannot be distinguished reliably from a valid image and may otherwise be
 * retained only on the device that encountered it.
 */



// A small navigation fetch handler keeps the PWA installable on older mobile
// browsers and provides a safe offline page without caching authenticated data.
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET" || request.mode !== "navigate") {
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const fallback = await caches.match(OFFLINE_URL);
      return (
        fallback ||
        new Response("Rovauto is offline.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    }),
  );
});

const getPushPayload = (event) => {
  if (!event.data) {
    return {
      title: "Rovauto Intern",
      body: "You have a new Rovauto update.",
      data: { url: "/intern" },
    };
  }

  try {
    return event.data.json();
  } catch {
    return {
      title: "Rovauto Intern",
      body: event.data.text() || "You have a new Rovauto update.",
      data: { url: "/intern" },
    };
  }
};

self.addEventListener("push", (event) => {
  const payload = getPushPayload(event);
  const title = payload.title || "Rovauto Intern";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || payload.message || "You have a new Rovauto update.",
      icon: payload.icon || "/intern-icon-512.png",
      badge: payload.badge || "/intern-notification-badge-96.png",
      tag: payload.tag || "rovauto-intern-notification",
      renotify: true,
      data: payload.data || { url: "/intern" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const requestedUrl = event.notification.data?.url || "/intern";
  let targetUrl;

  try {
    const resolved = new URL(requestedUrl, self.location.origin);
    targetUrl =
      resolved.origin === self.location.origin &&
      (resolved.pathname === "/intern" || resolved.pathname.startsWith("/intern/"))
        ? resolved.href
        : new URL("/intern", self.location.origin).href;
  } catch {
    targetUrl = new URL("/intern", self.location.origin).href;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windowClients) => {
        const target = new URL(targetUrl);
        const portalClient = windowClients.find((client) => {
          const clientUrl = new URL(client.url);
          return (
            clientUrl.origin === target.origin &&
            (clientUrl.pathname === "/intern" || clientUrl.pathname.startsWith("/intern/"))
          );
        });

        if (portalClient) {
          if ("navigate" in portalClient && portalClient.url !== targetUrl) {
            await portalClient.navigate(targetUrl).catch(() => {});
          }
          return portalClient.focus();
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
