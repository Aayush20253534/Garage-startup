import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiUploadCloud, FiVideo, FiX } from "react-icons/fi";

const MAX_VIDEO_SIZE_MB = 50;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

const getFile = (value) => value?.file || value || null;

export default function VideoUpload({ value = null, onChange }) {
  const [error, setError] = useState("");
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
              Exactly one video is required. Maximum size: 50 MB.
            </p>
          </div>
        </div>

        {!value ? (
          <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-ink-2">
            <FiUploadCloud aria-hidden="true" />
            Choose video
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/*"
              className="hidden"
              onChange={(event) => {
                selectVideo(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
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
