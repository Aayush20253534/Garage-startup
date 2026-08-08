import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FiCamera, FiGrid, FiImage, FiX } from "react-icons/fi";

const getPreview = (image) => {
  if (typeof image === "string") return image;
  return image.preview || image.imageUrl || "";
};

const OPTIMIZE_THRESHOLD_BYTES = 900 * 1024;
const OPTIMIZED_MAX_EDGE = 1920;
const OPTIMIZED_FALLBACK_EDGE = 1600;
const OPTIMIZED_TARGET_BYTES = 1500 * 1024;
const SERVER_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const loadBrowserImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to decode image"));
    };
    image.src = url;
  });

const canvasToBlob = (canvas, quality) =>
  new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

const renderOptimizedImage = async (image, maxEdge, quality) => {
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight, 1);
  const scale = Math.min(1, maxEdge / longestEdge);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) return null;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvasToBlob(canvas, quality);
};

const optimizeInspectionImage = async (file) => {
  try {
    const image = await loadBrowserImage(file);
    const needsResize =
      Math.max(image.naturalWidth, image.naturalHeight) > OPTIMIZED_MAX_EDGE;
    const needsConversion = !SERVER_IMAGE_TYPES.has(file.type);

    if (
      !needsResize &&
      !needsConversion &&
      file.size <= OPTIMIZE_THRESHOLD_BYTES
    ) {
      return { file, optimized: false };
    }

    let blob = await renderOptimizedImage(image, OPTIMIZED_MAX_EDGE, 0.82);
    if (blob && blob.size > OPTIMIZED_TARGET_BYTES) {
      blob = await renderOptimizedImage(image, OPTIMIZED_FALLBACK_EDGE, 0.74);
    }

    if (!blob) return { file, optimized: false };

    // Keep an already-small compatible source if JPEG conversion would make it
    // larger. Otherwise upload the smaller browser-normalized JPEG.
    if (
      SERVER_IMAGE_TYPES.has(file.type) &&
      blob.size >= file.size &&
      file.size <= OPTIMIZED_TARGET_BYTES
    ) {
      return { file, optimized: false };
    }

    const basename = String(file.name || "inspection-photo").replace(
      /\.[^.]+$/,
      "",
    );
    return {
      file: new File([blob], `${basename}.jpg`, {
        type: "image/jpeg",
        lastModified: file.lastModified || Date.now(),
      }),
      optimized: true,
    };
  } catch {
    return { file, optimized: false };
  }
};

const optimizeWithConcurrency = async (files, concurrency = 2) => {
  const results = new Array(files.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= files.length) return;
      results[index] = await optimizeInspectionImage(files[index]);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(1, files.length)) },
      () => worker(),
    ),
  );

  return results;
};

export default function ImageUpload({
  min,
  max,
  value = [],
  onChange,
  maxSizeMb = 1,
  countOffset = 0,
  totalMax = max,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(Array.from(event.dataTransfer.files));
  };

  const handleFiles = async (files) => {
    setError("");
    setNotice("");
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    const selectedImages = files.filter((file) =>
      file.type.startsWith("image/"),
    );
    const remainingSlots = Math.max(0, max - value.length);
    const filesWithinCapacity = selectedImages.slice(0, remainingSlots);
    const capacitySkippedCount =
      selectedImages.length - filesWithinCapacity.length;
    const optimizedResults = await optimizeWithConcurrency(filesWithinCapacity);
    const oversizedFiles = optimizedResults.filter(
      (result) => result.file.size > maxSizeBytes,
    );
    const validResults = optimizedResults.filter(
      (result) => result.file.size <= maxSizeBytes,
    );
    const optimizedCount = validResults.filter(
      (result) => result.optimized,
    ).length;
    const messages = [];

    if (oversizedFiles.length > 0) {
      messages.push(
        `${oversizedFiles.length} image${oversizedFiles.length === 1 ? " was" : "s were"} skipped because ${oversizedFiles.length === 1 ? "it is" : "they are"} still larger than ${maxSizeMb} MB after optimization`,
      );
    }
    if (capacitySkippedCount > 0) {
      messages.push(
        `${capacitySkippedCount} image${capacitySkippedCount === 1 ? " was" : "s were"} skipped because no gallery slots remain`,
      );
    }
    if (optimizedCount > 0) {
      setNotice(
        `${optimizedCount} photo${optimizedCount === 1 ? " was" : "s were"} optimized for faster mobile upload.`,
      );
    }

    if (messages.length > 0) {
      setError(`${messages.join(". ")}.`);
    }

    const imageFiles = validResults.map(({ file }) => ({
      id: `${file.name}-${file.lastModified}-${file.size}`,
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
    }));

    if (imageFiles.length === 0) return;

    onChange([...value, ...imageFiles]);
  };

  const handleInputChange = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    void handleFiles(files);
  };

  const removeImage = (index) => {
    const image = value[index];
    if (image?.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview);
    onChange(value.filter((_, imageIndex) => imageIndex !== index));
  };

  const uploadDisabled = value.length >= max;

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition-all sm:p-8 ${
          isDragging
            ? "border-brand bg-brand-soft"
            : "border-line hover:border-ink-2"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <FiImage className="mx-auto mb-3 h-12 w-12 text-muted" />
        <h4 className="font-semibold">Add inspection photos</h4>
        <p className="mt-1 text-sm text-muted">
          {countOffset + value.length} / {totalMax} uploaded
          {countOffset + value.length < min && (
            <span className="ml-2 text-red-500">(Minimum {min} required)</span>
          )}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted">
          Take a new photo with the rear camera or select existing photos from
          the device gallery. You can repeat the camera option until all photos
          are added.
        </p>

        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        {notice && (
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            {notice}
          </p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploadDisabled}
            className="group flex min-h-16 items-center gap-3 rounded-xl bg-ink px-4 text-left text-white transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 text-xl">
              <FiCamera aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold">Open camera</span>
              <span className="mt-0.5 block text-xs text-white/65">
                Take one clear photo
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploadDisabled}
            className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-white px-4 text-left text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-bg-soft text-xl">
              <FiGrid aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold">Choose from gallery</span>
              <span className="mt-0.5 block text-xs text-muted">
                Select one or multiple photos
              </span>
            </span>
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleInputChange}
          disabled={uploadDisabled}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleInputChange}
          disabled={uploadDisabled}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {value.map((image, index) => (
          <motion.div
            key={image.id || getPreview(image) || index}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-soft relative aspect-square overflow-hidden rounded-xl"
          >
            <img
              src={getPreview(image)}
              alt={`Upload ${index + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white transition-colors hover:bg-black"
              aria-label={`Remove photo ${index + 1}`}
            >
              <FiX className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
