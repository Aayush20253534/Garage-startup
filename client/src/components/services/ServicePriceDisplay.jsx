import {
  formatRupeeRange,
  formatRupees,
  getServiceMaxPrice,
  getServiceMinPrice,
} from "@/utils/priceRange";

const getReferenceRange = (service = {}) => {
  const min = Number(service.compareAtPriceRange?.min);
  const max = Number(service.compareAtPriceRange?.max);

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max: Math.max(min, max) };
};

export default function ServicePriceDisplay({
  service,
  mode = "range",
  className = "",
  regularClassName =
    "text-sm font-bold text-red-500 line-through decoration-2 decoration-red-400/90",
  currentClassName = "text-xl font-black tracking-tight text-ink",
}) {
  if (!service?.priceRange) return null;

  const min = getServiceMinPrice(service);
  const max = getServiceMaxPrice(service);
  const currentText =
    mode === "min" ? formatRupees(min) : formatRupeeRange(min, max);
  const reference = getReferenceRange(service);
  const referenceMarkupPercent = Number(service.referenceMarkupPercent);
  const hasReferencePrice =
    reference &&
    Number.isInteger(referenceMarkupPercent) &&
    referenceMarkupPercent > 0 &&
    (reference.min > min || reference.max > max);

  if (!hasReferencePrice) {
    return <span className={currentClassName}>{currentText}</span>;
  }

  const referenceText =
    mode === "min"
      ? formatRupees(reference.min)
      : formatRupeeRange(reference.min, reference.max);

  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}
    >
      <span className={currentClassName} aria-label={`Current price ${currentText}`}>
        {currentText}
      </span>
      <span
        className={regularClassName}
        aria-label={`City comparison price ${referenceText}`}
        title="City comparison price"
      >
        {referenceText}
      </span>
    </span>
  );
}
