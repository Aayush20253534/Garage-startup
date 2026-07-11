const GARAGE_IMAGE_CACHE = "rovauto-garage-cloudinary-images-v2";
const isCloudinaryHost = (hostname) =>
  hostname === "res.cloudinary.com" || hostname.endsWith(".cloudinary.com");

const isCloudinaryImage = (request) => {
  if (request.method !== "GET") return false;

  try {
    const url = new URL(request.url);
    return (
      isCloudinaryHost(url.hostname) &&
      (request.destination === "image" ||
        /\.(avif|gif|jpe?g|png|webp)$/i.test(url.pathname))
    );
  } catch {
    return false;
  }
};

const fetchAndCacheImage = async (request, cache) => {
  const response = await fetch(request, { cache: "no-store" });

  if (response && (response.ok || response.type === "opaque")) {
    await cache.put(request, response.clone());
  }

  return response;
};

const networkFirstImage = async (request) => {
  const cache = await caches.open(GARAGE_IMAGE_CACHE);

  try {
    // Always try the current Cloudinary asset first. The older cache-first
    // worker could keep an opaque failed response and repeatedly show a
    // broken image even after the asset became available.
    return await fetchAndCacheImage(request, cache);
  } catch {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
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
                key.startsWith("rovauto-garage-cloudinary-images-") &&
                key !== GARAGE_IMAGE_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (isCloudinaryImage(event.request)) {
    event.respondWith(networkFirstImage(event.request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "WARM_IMAGE_CACHE") return;

  const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
  event.waitUntil(
    caches.open(GARAGE_IMAGE_CACHE).then((cache) =>
      Promise.allSettled(
        urls
          .filter(Boolean)
          .map(
            (url) =>
              new Request(url, {
                mode: "no-cors",
                credentials: "omit",
                cache: "no-store",
              }),
          )
          .map((request) => fetchAndCacheImage(request, cache)),
      ),
    ),
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
