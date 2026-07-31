import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCamera,
  FiCheckCircle,
  FiFolder,
  FiVideo,
  FiX,
} from "react-icons/fi";

const MAX_VIDEO_SIZE_MB = 50;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const VIDEO_ACCEPT =
  "video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/*";

const getFile = (value) => value?.file || value || null;

export default function VideoUpload({ value = null, onChange }) {
  const [error, setError] = useState("");
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const file = getFile(value);
  const preview = useMemo(() => {
    if (!file) return "";
    if (value?.preview) return value.preview;
    if (typeof value === "string") return value;
    return URL.createObjectURL(file);
  }, [file, value]);

  useEffect(
    () => () => {
      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    },
    [preview, value?.preview],
  );

  const selectVideo = (selectedFile) => {
    setError("");
    if (!selectedFile) return;

    if (!selectedFile.type?.startsWith("video/")) {
      setError("Choose a valid video file.");
      return;
    }

    if (selectedFile.size > MAX_VIDEO_SIZE_BYTES) {
      setError("The inspection video must be 50 MB or less.");
      return;
    }

    if (value?.preview?.startsWith("blob:")) {
      URL.revokeObjectURL(value.preview);
    }

    onChange({
      id: `${selectedFile.name}-${selectedFile.lastModified}-${selectedFile.size}`,
      file: selectedFile,
      preview: URL.createObjectURL(selectedFile),
      name: selectedFile.name,
    });
  };

  const handleInputChange = (event) => {
    selectVideo(event.target.files?.[0]);
    event.target.value = "";
  };

  const removeVideo = () => {
    if (value?.preview?.startsWith("blob:")) {
      URL.revokeObjectURL(value.preview);
    }
    setError("");
    onChange(null);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-bg-soft p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-ink shadow-sm">
            <FiVideo aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">Inspection video</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Record a new video or select one from the gallery. Exactly one
              video is required. Maximum size: 50 MB.
            </p>
          </div>
        </div>

        {!value ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex min-h-16 items-center gap-3 rounded-xl bg-ink px-4 text-left text-white transition hover:bg-ink-2"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 text-xl">
                  <FiCamera aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-bold">Open camera</span>
                  <span className="mt-0.5 block text-xs text-white/65">
                    Record inspection video
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-white px-4 text-left text-ink transition hover:border-ink hover:bg-bg-soft"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-bg-soft text-xl">
                  <FiFolder aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-bold">Choose from gallery</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Select an existing video
                  </span>
                </span>
              </button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={handleInputChange}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept={VIDEO_ACCEPT}
              className="hidden"
              onChange={handleInputChange}
            />
          </>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-black">
            <video
              src={preview}
              controls
              playsInline
              preload="metadata"
              className="max-h-72 w-full bg-black object-contain"
            />
            <div className="flex items-center justify-between gap-3 bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-muted">
                  {value.name || file?.name || "Inspection video"}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-green-700">
                  <FiCheckCircle aria-hidden="true" /> Selected - ready to upload
                </p>
              </div>
              <button
                type="button"
                onClick={removeVideo}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 hover:bg-red-50"
              >
                <FiX aria-hidden="true" /> Remove
              </button>
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
    </div>
  );
}
