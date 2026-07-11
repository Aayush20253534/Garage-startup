const LEGACY_IMAGE_CACHE_PREFIX = "rovauto-admin-cloudinary-images-";

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
      title: "Rovauto Admin",
      body: "You have a new Rovauto update.",
      data: { url: "/admin" },
    };
  }

  try {
    return event.data.json();
  } catch {
    return {
      title: "Rovauto Admin",
      body: event.data.text() || "You have a new Rovauto update.",
      data: { url: "/admin" },
    };
  }
};

self.addEventListener("push", (event) => {
  const payload = getPushPayload(event);
  const title = payload.title || "Rovauto Admin";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || payload.message || "You have a new Rovauto update.",
      icon: payload.icon || "/admin-icon-512.png",
      badge: payload.badge || "/admin-notification-badge-96.png",
      tag: payload.tag || "rovauto-admin-notification",
      renotify: true,
      data: payload.data || { url: "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const requestedUrl = event.notification.data?.url || "/admin";
  let targetUrl;

  try {
    const resolved = new URL(requestedUrl, self.location.origin);
    targetUrl =
      resolved.origin === self.location.origin &&
      (resolved.pathname === "/admin" || resolved.pathname.startsWith("/admin/"))
        ? resolved.href
        : new URL("/admin", self.location.origin).href;
  } catch {
    targetUrl = new URL("/admin", self.location.origin).href;
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
            (clientUrl.pathname === "/admin" || clientUrl.pathname.startsWith("/admin/"))
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
