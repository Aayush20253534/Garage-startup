import { FiCamera } from "react-icons/fi";

export default function InspectionGallery({
  images = [],
  phase,
  title,
  description,
  emptyMessage = "No inspection photos uploaded yet.",
}) {
  const filteredImages = images
    .filter((image) => !phase || image.phase === phase)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  return (
    <section className="card-soft p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-ink">
          <FiCamera />
        </div>
        <div>
          <h3 className="font-bold text-ink">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
      </div>

      {filteredImages.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {filteredImages.map((image, index) => (
            <a
              key={image.id || `${phase}-${index}`}
              href={image.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-2xl border border-line bg-bg-soft"
            >
              <img
                src={image.imageUrl}
                alt={`${title} ${index + 1}`}
                className="aspect-square w-full object-cover transition duration-200 group-hover:scale-105"
              />
              <div className="px-2 py-1.5 text-center text-xs font-semibold text-muted">
                Photo {index + 1}
              </div>
            </a>
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
