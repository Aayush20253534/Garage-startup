import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FiArrowRight,
  FiCheck,
  FiClock,
  FiMapPin,
  FiNavigation,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiStar,
  FiTool,
} from "react-icons/fi";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";
import Seo from "@/components/seo/Seo";
import { formatServicePriceRange } from "@/utils/priceRange";
import { hasUsableIndiaCoordinates } from "@/utils/address";

const NEARBY_RADIUS_KM = 10;

const getGarageImage = (garage) =>
  garage?.thumbnail?.imageUrl || garage?.images?.[0]?.imageUrl || "";

const getGarageServices = (garage) =>
  Array.isArray(garage?.services) ? garage.services : [];

const getServiceName = (garageService) =>
  garageService?.service?.name || garageService?.name || "Vehicle service";

const getServicePrice = (garageService) => {
  const service = garageService?.service || garageService || {};
  const hasAnyPrice = [
    service.priceRange?.min,
    service.priceRange?.max,
    service.estimatedMinPrice,
    service.estimatedMaxPrice,
    service.price,
  ].some((value) => value !== undefined && value !== null);

  return hasAnyPrice ? formatServicePriceRange(service) : "Custom quote";
};

const getGarageArea = (garage, fallbackCity = "") =>
  [garage?.area, garage?.city].filter(Boolean).join(", ") ||
  fallbackCity ||
  "Service area available";

const getGarageAddress = (garage, fallbackCity = "") =>
  garage?.address || getGarageArea(garage, fallbackCity);

const formatRating = (garage) => {
  const rating = Number(garage?.ratingAvg ?? garage?.rating ?? 0);
  return Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "New";
};

const formatReviewCount = (garage) => {
  const count = Number(garage?.ratingCount ?? garage?.reviewCount ?? 0);
  if (!Number.isFinite(count) || count <= 0) return "No reviews yet";
  return `${count.toLocaleString("en-IN")} review${count === 1 ? "" : "s"}`;
};

const formatHours = (garage) => {
  if (!garage?.openingTime || !garage?.closingTime) return "Hours not listed";
  return `${garage.openingTime} – ${garage.closingTime}`;
};

const formatDistance = (garage) => {
  const roadDistance = Number(garage?.roadDistanceKm);
  const directDistance = Number(garage?.distanceKm);
  const distance =
    Number.isFinite(roadDistance) && roadDistance > 0
      ? roadDistance
      : directDistance;

  if (!Number.isFinite(distance) || distance <= 0) return null;
  return `${distance.toFixed(distance >= 10 ? 0 : 1)} km away`;
};

const getUsableCoordinates = (value) => {
  if (!value || typeof value !== "object") return null;
  if (!hasUsableIndiaCoordinates(value)) return null;

  return {
    latitude: Number(value.latitude),
    longitude: Number(value.longitude),
  };
};

const buildSearchParams = ({ city, search, openNow }) => {
  const next = new URLSearchParams();
  if (city.trim()) next.set("city", city.trim());
  if (search.trim()) next.set("search", search.trim());
  if (openNow) next.set("openNow", "true");
  return next;
};

function GarageCard({ garage, fallbackCity }) {
  const image = getGarageImage(garage);
  const services = getGarageServices(garage);
  const shownServices = services.slice(0, 3);
  const remainingServices = Math.max(
    services.length - shownServices.length,
    0,
  );
  const distance = formatDistance(garage);
  const acceptingRequests = garage.isActive !== false;

  return (
    <article className="group overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all duration-300 hover:border-ink/20 hover:shadow-md md:rounded-3xl">
      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left Side: Thumbnail section */}
        <div className="relative min-h-56 overflow-hidden bg-bg-soft lg:min-h-full">
          {image ? (
            <img
              src={image}
              alt={garage.name || "Garage"}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-bg-soft text-5xl text-muted/40">
              <FiTool className="animate-pulse" />
            </div>
          )}

          {/* Badges Layout inside image overlay */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
            {garage.isVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/90 px-2.5 py-1 text-xs font-bold text-ink shadow-sm backdrop-blur-md">
                <FiShield className="text-emerald-600" />
                Verified Partner
              </span>
            ) : (
              <span />
            )}

            {distance && (
              <span className="rounded-full bg-ink/80 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                {distance}
              </span>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-5 pb-4 pt-14 text-white">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-white/90">
              <FiMapPin className="shrink-0 text-brand" />
              <span className="line-clamp-1">
                {getGarageArea(garage, fallbackCity)}
              </span>
            </p>
          </div>
        </div>

        {/* Right Side: Main content container */}
        <div className="flex min-w-0 flex-col p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              {/* Operational Status Tag */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase ${
                    acceptingRequests
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      acceptingRequests ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  {acceptingRequests ? "Accepting Bookings" : "Unavailable"}
                </span>
              </div>

              <h2 className="mt-3.5 text-xl font-black tracking-tight text-ink sm:text-2xl">
                {garage.name || "Garage"}
              </h2>

              <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-muted">
                <FiMapPin className="mt-0.5 shrink-0 text-muted/70" />
                <span className="line-clamp-2">
                  {getGarageAddress(garage, fallbackCity)}
                </span>
              </p>
            </div>

            {/* Rating / Review High-Fidelity Block */}
            <div className="flex shrink-0 items-center gap-2.5 self-start rounded-xl border border-line bg-bg-soft/50 p-2 sm:px-3 sm:py-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-500 shadow-sm">
                <FiStar fill="currentColor" className="text-sm" />
              </span>
              <div>
                <div className="text-sm font-black text-ink leading-none">
                  {formatRating(garage)}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-muted leading-none">
                  {formatReviewCount(garage)}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Matrix Row */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-y border-line/70 py-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted">
                Operating Hours
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-ink">
                <FiClock className="shrink-0 text-muted/60" />
                <span className="line-clamp-1">{formatHours(garage)}</span>
              </p>
            </div>

            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted">
                Service Radius
              </p>
              <p className="mt-1.5 text-sm font-bold text-ink">
                {garage.workingRadiusKm || 15} km radius
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted">
                Proximity Distance
              </p>
              <p className="mt-1.5 text-sm font-bold text-ink">
                {distance || "Location Disabled"}
              </p>
            </div>
          </div>

          {/* Service Listing Segment */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-ink">Available Services</p>
              <p className="text-xs font-bold text-muted">
                {services.length > 0
                  ? `${services.length} Cataloged`
                  : "On-demand Booking Only"}
              </p>
            </div>

            {shownServices.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-line bg-white shadow-2xs">
                {shownServices.map((item, index) => (
                  <div
                    key={item.id || item.serviceId || getServiceName(item)}
                    className={`flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-bg-soft/40 ${
                      index > 0 ? "border-t border-line/60" : ""
                    }`}
                  >
                    <p className="min-w-0 truncate text-sm font-semibold text-ink">
                      {getServiceName(item)}
                    </p>
                    <p className="shrink-0 text-xs font-extrabold text-ink bg-bg-soft px-2 py-1 rounded-md">
                      {getServicePrice(item)}
                    </p>
                  </div>
                ))}

                {remainingServices > 0 && (
                  <div className="border-t border-line bg-bg-soft/50 px-4 py-2 text-center text-xs font-bold text-muted transition hover:text-ink">
                    +{remainingServices} more service
                    {remainingServices === 1 ? "" : "s"} listed in directory
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line bg-bg-soft/40 px-4 py-4 text-xs leading-relaxed text-muted">
                Service item pricing has not been published for this workspace. Proceed with standard checkout to match dynamically with eligibility rules.
              </div>
            )}
          </div>

          {/* Interactive Footer Toolbar */}
          <div className="mt-6 flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between border-t border-line/40">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/50 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-100">
                <FiCheck className="text-emerald-600" /> Catalog Verified
              </span>

              {garage.whatsappLink && (
                <a
                  href={garage.whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-bg-soft px-3 py-1.5 text-xs font-bold text-muted border border-line/60 transition hover:bg-brand-soft hover:text-ink"
                >
                  <FiPhone /> WhatsApp Connect
                </a>
              )}
            </div>

            <Link
              to="/booking/vehicle"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-bold text-white shadow-xs transition hover:bg-ink/90 active:scale-[0.98]"
            >
              Configure Setup <FiArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function GarageSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-xs">
      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="h-56 animate-pulse bg-bg-soft lg:h-auto" />
        <div className="p-6 sm:p-8">
          <div className="h-5 w-28 animate-pulse rounded-full bg-bg-soft" />
          <div className="mt-4 h-8 w-2/3 animate-pulse rounded-lg bg-bg-soft" />
          <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-bg-soft" />
          <div className="mt-6 h-16 animate-pulse rounded-xl bg-bg-soft" />
          <div className="mt-5 h-28 animate-pulse rounded-xl bg-bg-soft" />
        </div>
      </div>
    </div>
  );
}

export default function Garages() {
  const { location } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryCity = searchParams.get("city") || "";
  const savedCity = String(location?.city || "").trim();

  const initialFilters = {
    city: queryCity || savedCity,
    search: searchParams.get("search") || "",
    openNow: searchParams.get("openNow") === "true",
  };

  const [city, setCity] = useState(initialFilters.city);
  const [search, setSearch] = useState(initialFilters.search);
  const [openNow, setOpenNow] = useState(initialFilters.openNow);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [garages, setGarages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [browserLocation, setBrowserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    if (queryCity || city || !savedCity) return;

    const nextFilters = { city: savedCity, search: "", openNow: false };
    setCity(savedCity);
    setAppliedFilters(nextFilters);
    setSearchParams(buildSearchParams(nextFilters), { replace: true });
  }, [city, queryCity, savedCity, setSearchParams]);

  const activeLocation = useMemo(
    () => getUsableCoordinates(browserLocation),
    [browserLocation?.latitude, browserLocation?.longitude],
  );

  const requestParams = useMemo(
    () => ({
      verified: "true",
      ...(appliedFilters.city.trim() && {
        city: appliedFilters.city.trim(),
      }),
      ...(appliedFilters.search.trim() && {
        search: appliedFilters.search.trim(),
      }),
      ...(appliedFilters.openNow && { openNow: "true" }),
      ...(activeLocation && {
        latitude: activeLocation.latitude,
        longitude: activeLocation.longitude,
        radiusKm: NEARBY_RADIUS_KM,
      }),
    }),
    [
      appliedFilters,
      activeLocation?.latitude,
      activeLocation?.longitude,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    setLoading(true);
    setError("");

    api
      .get("/garages", {
        params: requestParams,
        signal: controller.signal,
      })
      .then((response) => {
        if (!mounted) return;
        const data = response.data?.data || response.data || [];
        setGarages(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (
          !mounted ||
          err.name === "CanceledError" ||
          err.code === "ERR_CANCELED"
        )
          return;
        setGarages([]);
        setError(
          err.response?.data?.message || "Unable to load garages right now.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [requestParams]);

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextFilters = { city, search, openNow };
    setAppliedFilters(nextFilters);
    setSearchParams(buildSearchParams(nextFilters), { replace: true });
  };

  const clearFilters = () => {
    const nextCity = savedCity || "";
    const nextFilters = { city: nextCity, search: "", openNow: false };

    setCity(nextCity);
    setSearch(nextFilters.search);
    setOpenNow(nextFilters.openNow);
    setAppliedFilters(nextFilters);
    setSearchParams(buildSearchParams(nextFilters), { replace: true });
  };

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("Location is not supported by this browser.");
      return;
    }

    setLocationLoading(true);
    setLocationMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBrowserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationMessage(
          `Showing garages within ${NEARBY_RADIUS_KM} km of your current location.`,
        );
        setLocationLoading(false);
      },
      () => {
        setLocationMessage(
          "Allow location access to see nearby garages and distance.",
        );
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const hasAppliedFilters = Boolean(
    appliedFilters.city.trim() ||
      appliedFilters.search.trim() ||
      appliedFilters.openNow ||
      activeLocation,
  );

  return (
    <>
      <Seo
        title="Verified Garages in Prayagraj"
        description="Browse verified Rovauto garage partners with ratings, service coverage, hours and booking access."
        path="/garages"
      />

      <main className="min-h-screen bg-bg-soft/40 pb-16">
        {/* Premium Corporate Hero Section */}
        <section className="relative overflow-hidden bg-ink py-16 text-white sm:py-24">
          {/* Visual Grid Backdrop Decor */}
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="pointer-events-none absolute -right-12 -top-24 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-24 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand">
                <FiShield className="text-sm" /> Professional Auto Network
              </span>

              <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl lg:leading-[1.1]">
                Find a trusted garage <br className="hidden sm:inline"/>
                <span className="bg-gradient-to-r from-brand via-amber-300 to-white bg-clip-text text-transparent">near your location.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
                Compare top-tier verified automotive partners by neighborhood, community ratings, true operation windows, and standardized pricing models.
              </p>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold uppercase tracking-wide text-white/60">
                <span className="inline-flex items-center gap-2">
                  <FiCheck className="text-brand text-sm" /> Inspected Workspaces
                </span>
                <span className="inline-flex items-center gap-2">
                  <FiCheck className="text-brand text-sm" /> Spatial Proximity Tracking
                </span>
                <span className="inline-flex items-center gap-2">
                  <FiCheck className="text-brand text-sm" /> Encrypted Checkout Routes
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Floating Combined Search & Controls Panel */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-20 -mt-10">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-line bg-white p-5 shadow-xl sm:p-6"
          >
            <div className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr_auto_auto] lg:items-end">
              <label className="block">
                <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-widest text-muted">
                  Search Workspace
                </span>
                <span className="relative block group-within:text-ink text-muted">
                  <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base transition-colors" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, landmark, address..."
                    className="h-12 w-full rounded-xl border border-line bg-bg-soft pl-11 pr-4 text-sm font-medium text-ink outline-none transition focus:border-ink focus:bg-white focus:ring-2 focus:ring-ink/5"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-widest text-muted">
                  Target City
                </span>
                <span className="relative block group-within:text-ink text-muted">
                  <FiMapPin className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base transition-colors" />
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Enter locality / city"
                    className="h-12 w-full rounded-xl border border-line bg-bg-soft pl-11 pr-4 text-sm font-medium text-ink outline-none transition focus:border-ink focus:bg-white focus:ring-2 focus:ring-ink/5"
                  />
                </span>
              </label>

              <button
                type="button"
                onClick={() => setOpenNow((value) => !value)}
                aria-pressed={openNow}
                className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-bold transition-all active:scale-[0.98] lg:min-w-36 ${
                  openNow
                    ? "border-ink bg-ink text-white shadow-xs"
                    : "border-line bg-white text-ink hover:bg-bg-soft"
                }`}
              >
                <FiClock className="text-base" /> Open Now
              </button>

              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-7 text-sm font-black text-black shadow-sm transition-all hover:bg-brand/95 active:scale-[0.98]"
              >
                Query Database <FiArrowRight />
              </button>
            </div>

            {/* Form Utility Metadata Toolbar */}
            <div className="mt-5 flex flex-col gap-4 border-t border-line/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={requestCurrentLocation}
                disabled={locationLoading}
                className="inline-flex items-center gap-2 self-start text-xs font-extrabold uppercase tracking-wider text-ink group disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-bg-soft border border-line group-hover:bg-ink group-hover:text-white transition-colors">
                  <FiNavigation
                    className={locationLoading ? "animate-spin" : "text-sm"}
                  />
                </span>
                {locationLoading ? "Analyzing Telemetry..." : "Geolocate Position"}
              </button>

              {hasAppliedFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 self-start text-xs font-bold text-muted transition hover:text-rose-600"
                >
                  <FiRefreshCw className="text-sm" /> Flush Search Parameters
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Directory Results Matrix */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12">
          {/* Subheader and System Meta Diagnostics */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-line pb-5">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted">
                System Registry View
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
                {loading ? (
                  <span className="inline-flex items-center gap-3">
                    Querying nodes...
                  </span>
                ) : (
                  `${garages.length} Partner Workstation${garages.length === 1 ? "" : "s"} Online`
                )}
              </h2>
              <p className="mt-2 text-sm font-medium text-muted">
                {activeLocation
                  ? `Spatial search matrix enabled within ${NEARBY_RADIUS_KM} km coordinates${
                      appliedFilters.city.trim()
                        ? ` inside ${appliedFilters.city.trim()}`
                        : ""
                    }`
                  : appliedFilters.city.trim()
                    ? `Displaying dynamic indexes active in ${appliedFilters.city.trim()}`
                    : "Displaying complete public service directory"}
              </p>
            </div>

            {activeLocation && (
              <span className="inline-flex self-start items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-1.5 text-xs font-bold text-emerald-800 sm:self-auto">
                <FiNavigation className="text-emerald-600" /> Active GPS Stream
              </span>
            )}
          </div>

          {locationMessage && (
            <div className="mb-6 rounded-xl border border-line bg-white/80 backdrop-blur-xs px-4 py-3 text-xs font-bold text-muted shadow-2xs">
              {locationMessage}
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          {/* Conditional Output Logic */}
          {loading ? (
            <div className="grid gap-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <GarageSkeleton key={index} />
              ))}
            </div>
          ) : garages.length > 0 ? (
            <div className="grid gap-6">
              {garages.map((garage) => (
                <GarageCard
                  key={garage.id}
                  garage={garage}
                  fallbackCity={appliedFilters.city}
                />
              ))}
            </div>
          ) : (
            /* Enhanced Clean Zero-state Screen */
            <div className="rounded-3xl border-2 border-dashed border-line bg-white px-6 py-16 text-center sm:px-10 shadow-sm">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-bg-soft border border-line text-3xl text-muted/60">
                <FiNavigation />
              </div>
              <h3 className="mt-5 text-xl font-black text-ink">
                No Workspace Registry Matches
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                No active partners found for your search telemetry. Try modifying filters or checking surrounding territories.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-bold text-white transition hover:bg-ink/90"
              >
                <FiRefreshCw /> Reset All Criteria
              </button>
            </div>
          )}
        </section>
      </main>
    </>
  );
}