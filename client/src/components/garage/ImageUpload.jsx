import { useState } from "react";
import { motion } from "framer-motion";
import { FiUpload, FiX, FiImage } from "react-icons/fi";

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

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
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

    const imageFiles = acceptedFiles
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
      }));

    if (imageFiles.length === 0) return;

    onChange([...value, ...imageFiles]);
  };

  const removeImage = (index) => {
    const image = value[index];
    if (image?.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview);
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          isDragging
            ? "border-brand bg-brand-soft"
            : "border-line hover:border-ink-2"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <FiImage className="w-12 h-12 mx-auto text-muted mb-3" />
        <h4 className="font-semibold mb-1">Drag & Drop Images</h4>
        <p className="text-muted text-sm mb-4">
          {countOffset + value.length} / {totalMax} Uploaded
          {countOffset + value.length < min && (
            <span className="text-red-500 ml-2">(Minimum {min} required)</span>
          )}
        </p>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <label className="btn-primary cursor-pointer">
          <FiUpload className="w-4 h-4" />
          <span>Browse Files</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
            disabled={value.length >= max}
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {value.map((image, index) => (
          <motion.div
            key={image.id || getPreview(image) || index}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative aspect-square rounded-xl overflow-hidden card-soft"
          >
            <img
              src={getPreview(image)}
              alt={`Upload ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full hover:bg-black transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
