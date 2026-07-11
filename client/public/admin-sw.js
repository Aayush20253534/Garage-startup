const ADMIN_IMAGE_CACHE = "rovauto-admin-cloudinary-images-v1";
const CLOUDINARY_HOSTS = ["res.cloudinary.com"];

const isCloudinaryImage = (request) => {
  if (request.method !== "GET") return false;

  try {
    const url = new URL(request.url);
    return (
      CLOUDINARY_HOSTS.includes(url.hostname) &&
      (request.destination === "image" || /\.(avif|gif|jpe?g|png|webp)$/i.test(url.pathname))
    );
  } catch {
    return false;
  }
};

const cacheImage = async (request) => {
  const cache = await caches.open(ADMIN_IMAGE_CACHE);
  const cached = await cache.match(request);
  const networkRequest = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkRequest;
};

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
            .filter(
              (key) =>
                key.startsWith("rovauto-admin-cloudinary-images-") &&
                key !== ADMIN_IMAGE_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (isCloudinaryImage(event.request)) {
    event.respondWith(cacheImage(event.request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "WARM_IMAGE_CACHE") return;

  const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
  event.waitUntil(
    caches.open(ADMIN_IMAGE_CACHE).then((cache) =>
      Promise.allSettled(
        urls
          .filter(Boolean)
          .map(
            (url) =>
              new Request(url, {
                mode: "no-cors",
                credentials: "omit",
              }),
          )
          .map((request) =>
            fetch(request).then((response) => {
              if (response && (response.ok || response.type === "opaque")) {
                return cache.put(request, response);
              }
              return null;
            }),
          ),
      ),
    ),
  );
});

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
