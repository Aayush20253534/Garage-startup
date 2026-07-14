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
    const oversizedFile = files.find(
      (file) => file.type.startsWith("image/") && file.size > maxSizeBytes,
    );
    if (oversizedFile) {
      setError(`Each image must be less than or equal to ${maxSizeMb} MB.`);
      return;
    }

    const imageFiles = files
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
      }));

    onChange([...value, ...imageFiles].slice(0, max));
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
