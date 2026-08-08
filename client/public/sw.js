const LEGACY_IMAGE_CACHE_PREFIX = "rovauto-cloudinary-images-";
const OFFLINE_URL = "/offline.html";
const SHELL_CACHE_PREFIX = "rovauto-customer-shell-";
const SHELL_CACHE = "rovauto-customer-shell-v3";

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
      title: "Rovauto",
      body: "You have a new Rovauto update.",
      data: { url: "/" },
    };
  }

  try {
    return event.data.json();
  } catch {
    return {
      title: "Rovauto",
      body: event.data.text() || "You have a new Rovauto update.",
      data: { url: "/" },
    };
  }
};

self.addEventListener("push", (event) => {
  const payload = getPushPayload(event);
  const title = payload.title || "Rovauto";

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: payload.body || payload.message || "You have a new Rovauto update.",
        icon: payload.icon || "/rovauto-brand-v3-icon-512.png",
        badge: payload.badge || "/notification-badge-96.png",
        tag: payload.tag || "rovauto-notification",
        renotify: true,
        data: payload.data || { url: "/" },
      }),
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) =>
          clients.forEach((client) =>
            client.postMessage({
              type: "ROVAUTO_PUSH_RECEIVED",
              payload,
            }),
          ),
        ),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const requestedUrl = event.notification.data?.url || "/";
  let targetUrl;

  try {
    const resolved = new URL(requestedUrl, self.location.origin);
    targetUrl =
      resolved.origin === self.location.origin
        ? resolved.href
        : new URL("/", self.location.origin).href;
  } catch {
    targetUrl = new URL("/", self.location.origin).href;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windowClients) => {
        const target = new URL(targetUrl);
        const matchingClient = windowClients.find((client) => {
          const clientUrl = new URL(client.url);
          return (
            clientUrl.origin === target.origin &&
            clientUrl.pathname === target.pathname
          );
        });

        if (matchingClient) {
          if ("navigate" in matchingClient && matchingClient.url !== targetUrl) {
            await matchingClient.navigate(targetUrl).catch(() => {});
          }
          return matchingClient.focus();
        }

        const sameOriginClient = windowClients.find(
          (client) => new URL(client.url).origin === target.origin,
        );

        if (sameOriginClient) {
          if ("navigate" in sameOriginClient) {
            await sameOriginClient.navigate(targetUrl).catch(() => {});
          }
          return sameOriginClient.focus();
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
