const LEGACY_IMAGE_CACHE_PREFIX = "rovauto-support-cloudinary-images-";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(LEGACY_IMAGE_CACHE_PREFIX))
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

const getPushPayload = (event) => {
  if (!event.data) {
    return {
      title: "Rovauto Support",
      body: "You have a new support alert.",
      data: { url: "/support/notify" },
    };
  }

  try {
    return event.data.json();
  } catch {
    return {
      title: "Rovauto Support",
      body: event.data.text() || "You have a new support alert.",
      data: { url: "/support/notify" },
    };
  }
};

self.addEventListener("push", (event) => {
  const payload = getPushPayload(event);
  const title = payload.title || "Rovauto Support";

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: payload.body || payload.message || "You have a new support alert.",
        icon: payload.icon || "/support-icon-512.png",
        badge: payload.badge || "/support-notification-badge-96.png",
        tag: payload.tag || "rovauto-support-notification",
        renotify: true,
        data: payload.data || { url: "/support/notify" },
      }),
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) =>
          clients.forEach((client) =>
            client.postMessage({
              type: "ROVAUTO_SUPPORT_PUSH_RECEIVED",
              payload,
            }),
          ),
        ),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const requestedUrl = event.notification.data?.url || "/support/notify";
  let targetUrl;

  try {
    const resolved = new URL(requestedUrl, self.location.origin);
    targetUrl =
      resolved.origin === self.location.origin &&
      (resolved.pathname === "/support" || resolved.pathname.startsWith("/support/"))
        ? resolved.href
        : new URL("/support/notify", self.location.origin).href;
  } catch {
    targetUrl = new URL("/support/notify", self.location.origin).href;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windowClients) => {
        const target = new URL(targetUrl);
        const matchingClient = windowClients.find((client) => {
          const clientUrl = new URL(client.url);
          return clientUrl.origin === target.origin && clientUrl.pathname === target.pathname;
        });

        if (matchingClient) {
          if ("navigate" in matchingClient && matchingClient.url !== targetUrl) {
            await matchingClient.navigate(targetUrl).catch(() => {});
          }
          return matchingClient.focus();
        }

        const supportClient = windowClients.find((client) => {
          const clientUrl = new URL(client.url);
          return clientUrl.origin === target.origin && clientUrl.pathname.startsWith("/support");
        });

        if (supportClient) {
          if ("navigate" in supportClient) {
            await supportClient.navigate(targetUrl).catch(() => {});
          }
          return supportClient.focus();
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
