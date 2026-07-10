const SUPPORT_IMAGE_CACHE = "rovauto-support-cloudinary-images-v1";
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
  const cache = await caches.open(SUPPORT_IMAGE_CACHE);
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
                key.startsWith("rovauto-support-cloudinary-images-") &&
                key !== SUPPORT_IMAGE_CACHE,
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
    caches.open(SUPPORT_IMAGE_CACHE).then((cache) =>
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
        icon: payload.icon || "/support-icon-192.png",
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
