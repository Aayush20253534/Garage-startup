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
  regularClassName = "text-2xl font-black text-red-600 line-through decoration-[3px] decoration-red-500/90",
  currentClassName = "text-lg font-extrabold text-ink",
  badgeClassName = "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800",
  showBadge = true,
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
    <div
      className={`inline-flex max-w-full flex-wrap items-end gap-x-3 gap-y-1.5 rounded-xl border border-line/80 bg-white/90 px-2.5 py-2 shadow-sm ${className}`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-red-500 sm:text-[10px]">
          Reference +{referenceMarkupPercent}%
        </span>
        <span className={regularClassName}>{referenceText}</span>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted sm:text-[10px]">
          Rovauto price
        </span>
        <span className={currentClassName}>{currentText}</span>
      </div>

      {showBadge && <span className={badgeClassName}>Actual price</span>}
    </div>
  );
}
