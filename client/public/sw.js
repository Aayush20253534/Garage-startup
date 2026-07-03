const IMAGE_CACHE = "rovauto-cloudinary-images-v1";
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
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  const fresh = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fresh;
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
            .filter((key) => key.startsWith("rovauto-cloudinary-images-") && key !== IMAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (!isCloudinaryImage(event.request)) return;
  event.respondWith(cacheImage(event.request));
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "WARM_IMAGE_CACHE") return;

  const urls = Array.isArray(event.data.urls) ? event.data.urls : [];

  event.waitUntil(
    caches.open(IMAGE_CACHE).then((cache) =>
      Promise.allSettled(
        urls
          .filter(Boolean)
          .map((url) => new Request(url, { mode: "no-cors", credentials: "omit" }))
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
