const GARAGE_IMAGE_CACHE_PREFIX = "rovauto-garage-cloudinary-images-";
const OFFLINE_URL = "/offline.html";
const SHELL_CACHE_PREFIX = "rovauto-garage-shell-";
const SHELL_CACHE = "rovauto-garage-shell-v1";

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
                key.startsWith(GARAGE_IMAGE_CACHE_PREFIX) ||
                (key.startsWith(SHELL_CACHE_PREFIX) && key !== SHELL_CACHE),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/*
 * Garage photos deliberately bypass the service-worker cache. Cross-origin
 * image responses are opaque, so a temporary Cloudinary 404 cannot be
 * distinguished from a successful response and could otherwise be retained
 * as a permanently broken image. The browser cache and the API delivery
 * endpoint handle garage-photo caching safely.
 */
self.addEventListener("message", (event) => {
  if (event.data?.type !== "WARM_IMAGE_CACHE") return;

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(GARAGE_IMAGE_CACHE_PREFIX))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});

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
      title: "Rovauto Garage",
      body: "You have a new garage update.",
      data: { url: "/garage" },
    };
  }

  try {
    return event.data.json();
  } catch {
    return {
      title: "Rovauto Garage",
      body: event.data.text() || "You have a new garage update.",
      data: { url: "/garage" },
    };
  }
};

self.addEventListener("push", (event) => {
  const payload = getPushPayload(event);
  const title = payload.title || "Rovauto Garage";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || payload.message || "You have a new garage update.",
      icon: "/garage-icon-512.png",
      badge: "/garage-notification-badge-96.png",
      tag: payload.tag || "rovauto-garage-notification",
      renotify: true,
      data: payload.data || { url: "/garage" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const requestedUrl = event.notification.data?.url || "/garage";
  let targetUrl;

  try {
    const resolved = new URL(requestedUrl, self.location.origin);
    targetUrl =
      resolved.origin === self.location.origin &&
      (resolved.pathname === "/garage" ||
        resolved.pathname.startsWith("/garage/"))
        ? resolved.href
        : new URL("/garage", self.location.origin).href;
  } catch {
    targetUrl = new URL("/garage", self.location.origin).href;
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
            (clientUrl.pathname === "/garage" ||
              clientUrl.pathname.startsWith("/garage/"))
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
