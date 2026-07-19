import { useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiExternalLink,
  FiMapPin,
  FiTool,
  FiTruck,
  FiX,
} from "react-icons/fi";
import SafeImage from "@/components/common/SafeImage";
import {
  getGarageImageDeliveryUrl,
  resolveMediaUrl,
} from "@/utils/mediaUrl";

const unique = (values = []) => [
  ...new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
];

const normalizeBrands = (value) => {
  if (Array.isArray(value)) return unique(value);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? unique(parsed) : [];
  } catch {
    return unique(String(value).split(","));
  }
};

const getCoverImage = (garage) => {
  const images = Array.isArray(garage?.images) ? garage.images : [];
  const image =
    garage?.thumbnail ||
    images.find((item) => item?.isThumbnail) ||
    images[0];

  return resolveMediaUrl(image) || getGarageImageDeliveryUrl(image);
};

const getServiceNames = (garage) =>
  unique(
    (Array.isArray(garage?.services) ? garage.services : []).map(
      (assignment) => assignment?.service?.name,
    ),
  ).sort((left, right) => left.localeCompare(right));

const getVehicleCoverage = (garage) => {
  const assignments = Array.isArray(garage?.services) ? garage.services : [];
  const scopes = assignments.map((assignment) => {
    const brand = String(assignment?.vehicleBrand || "ALL").trim();
    const model = String(assignment?.vehicleModel || "ALL").trim();

    if (brand === "ALL") return "All supported vehicles";
    if (model === "ALL") return `${brand} · All models`;
    return `${brand} ${model}`;
  });

  return unique(scopes).sort((left, right) => left.localeCompare(right));
};

const getGarageType = (value) => {
  if (value === "AUTHORIZED") return "Authorized garage";
  if (value === "MULTI_BRAND") return "Multi-brand garage";
  return String(value || "Verified garage").replaceAll("_", " ");
};

function EmptyCover({ compact = false, className = "" }) {
  return (
    <div
      className={`grid w-full place-items-center bg-bg-soft text-muted ${
        className || (compact ? "h-32" : "h-40 sm:h-44")
      }`}
    >
      <FiTool className="h-8 w-8" />
    </div>
  );
}

function DetailGroup({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-ink">
        <Icon className="text-muted" />
        {title}
      </div>
      <div className="mt-3 text-sm leading-6 text-muted">{children}</div>
    </section>
  );
}

export default function AcceptedGarageCard({
  garage,
  compact = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const coverImage = useMemo(() => getCoverImage(garage), [garage]);
  const serviceNames = useMemo(() => getServiceNames(garage), [garage]);
  const supportedBrands = useMemo(
    () => normalizeBrands(garage?.supportedBrands),
    [garage?.supportedBrands],
  );
  const vehicleCoverage = useMemo(() => getVehicleCoverage(garage), [garage]);
  const hasCoordinates =
    Number.isFinite(Number(garage?.latitude)) &&
    Number.isFinite(Number(garage?.longitude));
  const address = unique([
    garage?.address,
    garage?.area,
    garage?.city,
  ]).join(", ");
  const workingHours =
    garage?.openingTime && garage?.closingTime
      ? `${garage.openingTime} – ${garage.closingTime}`
      : "Hours not provided";

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!garage) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group w-full overflow-hidden rounded-xl border border-line bg-white text-left shadow-sm transition hover:border-ink/25 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand/40 ${className}`}
        aria-label={`View details for ${garage.name}`}
      >
        <div className="relative overflow-hidden bg-bg-soft">
          <SafeImage
            src={coverImage}
            alt={`${garage.name} cover`}
            className={`w-full object-cover transition duration-300 group-hover:scale-[1.02] ${
              compact ? "h-32" : "h-40 sm:h-44"
            }`}
            fallback={<EmptyCover compact={compact} />}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/80">
                  {garage.isVerified && <FiCheckCircle />}
                  Assigned garage
                </div>
                <h3 className="mt-1 truncate text-lg font-bold">
                  {garage.name}
                </h3>
                <p className="mt-0.5 truncate text-xs text-white/75">
                  {garage.area || garage.city || "Location available in details"}
                </p>
              </div>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur">
                <FiChevronRight />
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0 truncate text-xs font-medium text-muted">
            {getGarageType(garage.garageType)} · Tap for garage details
          </span>
          <span className="shrink-0 text-xs font-bold text-ink">View details</span>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="accepted-garage-title"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-bg-soft shadow-2xl sm:max-w-3xl sm:rounded-2xl"
          >
            <div className="relative h-48 overflow-hidden bg-bg-soft sm:h-64">
              <SafeImage
                src={coverImage}
                alt={`${garage.name} cover`}
                className="h-full w-full object-cover"
                fallback={<EmptyCover className="h-full" />}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/20" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
                aria-label="Close garage details"
              >
                <FiX />
              </button>
              <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-white/80">
                  {garage.isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">
                      <FiCheckCircle /> Verified
                    </span>
                  )}
                  <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">
                    {getGarageType(garage.garageType)}
                  </span>
                </div>
                <h2
                  id="accepted-garage-title"
                  className="mt-3 text-2xl font-bold sm:text-3xl"
                >
                  {garage.name}
                </h2>
                <p className="mt-1 text-sm text-white/75">
                  {garage.area || garage.city || "Assigned garage"}
                </p>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-6">
              {garage.description && (
                <p className="rounded-xl border border-line bg-white p-4 text-sm leading-6 text-muted">
                  {garage.description}
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <DetailGroup icon={FiMapPin} title="Location">
                  <p>{address || "Location not provided"}</p>
                  {hasCoordinates && (
                    <a
                      href={`https://www.google.com/maps?q=${garage.latitude},${garage.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 font-bold text-ink hover:underline"
                    >
                      Open in Maps <FiExternalLink />
                    </a>
                  )}
                </DetailGroup>

                <DetailGroup icon={FiClock} title="Working hours">
                  <p>{workingHours}</p>
                </DetailGroup>

                <DetailGroup icon={FiTool} title="Services provided">
                  {serviceNames.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {serviceNames.map((serviceName) => (
                        <li
                          key={serviceName}
                          className="rounded-full border border-line bg-bg-soft px-3 py-1 text-xs font-semibold text-ink"
                        >
                          {serviceName}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Service information is not available.</p>
                  )}
                </DetailGroup>

                <DetailGroup icon={FiTruck} title="Vehicles catered">
                  {supportedBrands.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted">
                        Brands
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {supportedBrands.map((brand) => (
                          <span
                            key={brand}
                            className="rounded-full border border-line bg-bg-soft px-3 py-1 text-xs font-semibold text-ink"
                          >
                            {brand}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className={supportedBrands.length > 0 ? "mt-4" : ""}>
                    {vehicleCoverage.length > 0 ? (
                      <ul className="space-y-1.5">
                        {vehicleCoverage.map((scope) => (
                          <li key={scope}>• {scope}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Vehicle coverage is based on the assigned services.</p>
                    )}
                  </div>
                </DetailGroup>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
