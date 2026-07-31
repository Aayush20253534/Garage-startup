import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FiCamera, FiGrid, FiImage, FiX } from "react-icons/fi";

const getPreview = (image) => {
  if (typeof image === "string") return image;
  return image.preview || image.imageUrl || "";
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
    handleFiles(Array.from(event.dataTransfer.files));
  };

  const handleFiles = (files) => {
    setError("");
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    const selectedImages = files.filter((file) =>
      file.type.startsWith("image/"),
    );
    const oversizedFiles = selectedImages.filter(
      (file) => file.size > maxSizeBytes,
    );
    const validFiles = selectedImages.filter(
      (file) => file.size <= maxSizeBytes,
    );
    const remainingSlots = Math.max(0, max - value.length);
    const acceptedFiles = validFiles.slice(0, remainingSlots);
    const capacitySkippedCount = validFiles.length - acceptedFiles.length;
    const messages = [];

    if (oversizedFiles.length > 0) {
      messages.push(
        `${oversizedFiles.length} image${oversizedFiles.length === 1 ? " was" : "s were"} skipped because ${oversizedFiles.length === 1 ? "it is" : "they are"} larger than ${maxSizeMb} MB`,
      );
    }
    if (capacitySkippedCount > 0) {
      messages.push(
        `${capacitySkippedCount} image${capacitySkippedCount === 1 ? " was" : "s were"} skipped because no gallery slots remain`,
      );
    }

    if (messages.length > 0) {
      setError(`${messages.join(". ")}.`);
    }

    const imageFiles = acceptedFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${file.size}`,
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
    }));

    if (imageFiles.length === 0) return;

    onChange([...value, ...imageFiles]);
  };

  const handleInputChange = (event) => {
    handleFiles(Array.from(event.target.files || []));
    event.target.value = "";
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
