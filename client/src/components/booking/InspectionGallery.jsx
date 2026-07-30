import { useState } from "react";
import {
  FiCamera,
  FiCheckCircle,
  FiExternalLink,
  FiRefreshCw,
  FiVideo,
} from "react-icons/fi";
import { getCompatibleVideoUrl } from "@/utils/cloudinaryVideo";

const isVideo = (item) => item?.mediaType === "VIDEO";

function InspectionVideo({ video, title, index }) {
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const compatibleUrl = getCompatibleVideoUrl(video);
  const originalUrl = video?.imageUrl || compatibleUrl;

  const retryPlayback = () => {
    setPlaybackFailed(false);
    setReloadKey((current) => current + 1);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-black">
      <video
        key={`${video?.id || index}-${reloadKey}`}
        controls
        playsInline
        preload="metadata"
        className="max-h-[28rem] w-full bg-black object-contain"
        onCanPlay={() => setPlaybackFailed(false)}
        onError={() => setPlaybackFailed(true)}
      >
        <source src={compatibleUrl} type="video/mp4" />
        {originalUrl !== compatibleUrl && <source src={originalUrl} />}
        Your browser does not support HTML video playback.
      </video>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2.5 text-xs">
        <span className="inline-flex items-center gap-2 font-semibold text-green-700">
          <FiCheckCircle aria-hidden="true" /> Uploaded video
        </span>

        {playbackFailed ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={retryPlayback}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 font-semibold text-ink hover:bg-bg-soft"
            >
              <FiRefreshCw aria-hidden="true" /> Retry
            </button>
            <a
              href={compatibleUrl || originalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 font-semibold text-ink hover:bg-bg-soft"
            >
              <FiExternalLink aria-hidden="true" /> Open video
            </a>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-semibold text-muted">
            <FiVideo aria-hidden="true" /> {title} video {index + 1}
          </span>
        )}
      </div>

      {playbackFailed && (
        <p className="border-t border-line bg-white px-3 py-2 text-xs leading-5 text-red-600">
          The browser could not start playback. Retry once while the compatible
          MP4 finishes processing, or open the video directly.
        </p>
      )}
    </div>
  );
}

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

        {filteredMedia.length > 0 && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-700">
            <FiCheckCircle aria-hidden="true" /> Uploaded
          </span>
        )}
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
                  <div className="flex min-h-8 items-center justify-center gap-1.5 px-2 py-1.5 text-center text-xs font-semibold text-muted">
                    <FiCheckCircle className="text-green-600" aria-hidden="true" />
                    Photo {index + 1}
                  </div>
                </a>
              ))}
            </div>
          )}

          {videos.map((video, index) => (
            <InspectionVideo
              key={video.id || `${phase}-video-${index}`}
              video={video}
              title={title}
              index={index}
            />
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
