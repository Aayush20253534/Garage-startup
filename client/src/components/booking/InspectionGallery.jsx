import { FiCamera, FiVideo } from "react-icons/fi";

const isVideo = (item) => item?.mediaType === "VIDEO";

export default function InspectionGallery({
  images = [],
  phase,
  title,
  description,
  emptyMessage = "No inspection evidence uploaded yet.",
}) {
  const filteredMedia = images
    .filter((item) => !phase || item.phase === phase)
    .sort((a, b) => {
      if (isVideo(a) !== isVideo(b)) return isVideo(a) ? 1 : -1;
      return Number(a.order || 0) - Number(b.order || 0);
    });
  const photos = filteredMedia.filter((item) => !isVideo(item));
  const videos = filteredMedia.filter(isVideo);

  return (
    <section className="card-soft p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-ink">
          <FiCamera />
        </div>
        <div>
          <h3 className="font-bold text-ink">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
      </div>

      {filteredMedia.length > 0 ? (
        <div className="mt-5 space-y-4">
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {photos.map((image, index) => (
                <a
                  key={image.id || `${phase}-photo-${index}`}
                  href={image.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border border-line bg-bg-soft"
                >
                  <img
                    src={image.imageUrl}
                    alt={`${title} photo ${index + 1}`}
                    className="aspect-square w-full object-cover transition duration-200 group-hover:scale-105"
                  />
                  <div className="min-h-8 px-2 py-1.5 text-center text-xs font-semibold text-muted">
                    Photo {index + 1}
                  </div>
                </a>
              ))}
            </div>
          )}

          {videos.map((video, index) => (
            <div
              key={video.id || `${phase}-video-${index}`}
              className="overflow-hidden rounded-xl border border-line bg-black"
            >
              <video
                src={video.imageUrl}
                controls
                preload="metadata"
                className="max-h-[28rem] w-full bg-black object-contain"
              />
              <div className="flex items-center gap-2 bg-white px-3 py-2 text-xs font-semibold text-muted">
                <FiVideo aria-hidden="true" /> Inspection video
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-bg-soft px-4 py-5 text-sm text-muted">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}
