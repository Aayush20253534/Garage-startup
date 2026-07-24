import {
  formatRupeeRange,
  formatRupees,
  getServiceMaxPrice,
  getServiceMinPrice,
} from "@/utils/priceRange";

const getRegularRange = (service = {}) => {
  const min = Number(service.regularPriceRange?.min);
  const max = Number(service.regularPriceRange?.max);

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max: Math.max(min, max) };
};

export default function ServicePriceDisplay({
  service,
  mode = "range",
  className = "",
  regularClassName = "text-2xl font-extrabold text-red-600 line-through decoration-2",
  currentClassName = "text-lg font-extrabold text-ink",
  badgeClassName = "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800",
  showBadge = true,
}) {
  if (!service?.priceRange) return null;

  const min = getServiceMinPrice(service);
  const max = getServiceMaxPrice(service);
  const currentText = mode === "min" ? formatRupees(min) : formatRupeeRange(min, max);
  const regular = getRegularRange(service);
  const discountPercent = Number(service.discountPercent);
  const hasDiscount =
    regular &&
    Number.isInteger(discountPercent) &&
    discountPercent > 0 &&
    (regular.min > min || regular.max > max);

  if (!hasDiscount) {
    return <span className={currentClassName}>{currentText}</span>;
  }

  const regularText =
    mode === "min"
      ? formatRupees(regular.min)
      : formatRupeeRange(regular.min, regular.max);

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <span className={regularClassName}>{regularText}</span>
      <span className={currentClassName}>{currentText}</span>
      {showBadge && (
        <span className={badgeClassName}>{discountPercent}% off</span>
      )}
    </div>
  );
}
