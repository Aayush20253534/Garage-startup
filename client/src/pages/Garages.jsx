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
    <article className="group overflow-hidden rounded-3xl border border-line bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-soft">
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="relative min-h-60 overflow-hidden bg-bg-soft lg:min-h-full">
          {image ? (
            <img
              src={image}
              alt={garage.name || "Garage"}
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-bg-soft text-5xl text-muted/60">
              <FiTool />
            </div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
            {garage.isVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-xs font-bold text-ink shadow-sm backdrop-blur">
                <FiShield className="text-green-600" />
                Rovauto verified
              </span>
            ) : (
              <span />
            )}

            {distance && (
              <span className="rounded-full bg-ink/90 px-3 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur">
                {distance}
              </span>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-5 pb-5 pt-16 text-white">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FiMapPin className="shrink-0" />
              <span className="line-clamp-1">
                {getGarageArea(garage, fallbackCity)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                    acceptingRequests
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      acceptingRequests ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  {acceptingRequests ? "Accepting bookings" : "Unavailable"}
                </span>
              </div>

              <h2 className="mt-3 text-2xl font-extrabold leading-tight text-ink sm:text-[1.7rem]">
                {garage.name || "Garage"}
              </h2>

              <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-muted">
                <FiMapPin className="mt-1 shrink-0" />
                <span className="line-clamp-2">
                  {getGarageAddress(garage, fallbackCity)}
                </span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2.5 self-start rounded-2xl border border-line bg-bg-soft px-3.5 py-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-500">
                <FiStar fill="currentColor" />
              </span>
              <div>
                <div className="text-sm font-extrabold text-ink">
                  {formatRating(garage)}
                </div>
                <div className="text-[11px] font-medium text-muted">
                  {formatReviewCount(garage)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-y border-line py-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                Hours
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-ink">
                <FiClock className="shrink-0 text-muted" />
                <span className="line-clamp-1">{formatHours(garage)}</span>
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                Coverage
              </p>
              <p className="mt-1.5 text-sm font-bold text-ink">
                {garage.workingRadiusKm || 15} km radius
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                Distance
              </p>
              <p className="mt-1.5 text-sm font-bold text-ink">
                {distance || "Enable location"}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold text-ink">Available services</p>
              <p className="text-xs font-semibold text-muted">
                {services.length > 0
                  ? `${services.length} listed`
                  : "Booking available"}
              </p>
            </div>

            {shownServices.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-line">
                {shownServices.map((item, index) => (
                  <div
                    key={item.id || item.serviceId || getServiceName(item)}
                    className={`flex items-center justify-between gap-4 bg-white px-4 py-3 ${
                      index > 0 ? "border-t border-line" : ""
                    }`}
                  >
                    <p className="min-w-0 truncate text-sm font-semibold text-ink">
                      {getServiceName(item)}
                    </p>
                    <p className="shrink-0 text-xs font-bold text-muted">
                      {getServicePrice(item)}
                    </p>
                  </div>
                ))}

                {remainingServices > 0 && (
                  <div className="border-t border-line bg-bg-soft px-4 py-2.5 text-xs font-bold text-muted">
                    +{remainingServices} more service
                    {remainingServices === 1 ? "" : "s"} available
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-bg-soft px-4 py-4 text-sm leading-6 text-muted">
                Service pricing is not published yet. Start a booking and Rovauto
                will match your vehicle with this garage where eligible.
              </div>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-soft px-3 py-1.5">
                <FiCheck className="text-green-600" /> Verified information
              </span>

              {garage.whatsappLink && (
                <a
                  href={garage.whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-bg-soft px-3 py-1.5 transition hover:bg-brand-soft hover:text-ink"
                >
                  <FiPhone /> WhatsApp
                </a>
              )}
            </div>

            <Link
              to="/booking/vehicle"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink-2"
            >
              Book service <FiArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function GarageSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-60 animate-pulse bg-bg-soft lg:h-auto" />
        <div className="p-5 sm:p-6 lg:p-7">
          <div className="h-6 w-28 animate-pulse rounded-full bg-bg-soft" />
          <div className="mt-4 h-8 w-2/3 animate-pulse rounded-lg bg-bg-soft" />
          <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-bg-soft" />
          <div className="mt-6 h-20 animate-pulse rounded-2xl bg-bg-soft" />
          <div className="mt-5 h-36 animate-pulse rounded-2xl bg-bg-soft" />
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

      <main className="min-h-screen bg-bg-soft">
        <section className="relative overflow-hidden bg-ink text-white">
          <div className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-brand/10" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-brand/60 to-transparent" />

          <div className="container-x relative py-14 sm:py-18 lg:py-20">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/75">
                <FiShield className="text-brand" /> Verified garage partners
              </span>

              <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
                Find a trusted garage near you.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
                Compare verified Rovauto partners by location, ratings, operating
                hours and available services before you book.
              </p>

              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-white/75">
                <span className="inline-flex items-center gap-2">
                  <FiCheck className="text-brand" /> Verified partner details
                </span>
                <span className="inline-flex items-center gap-2">
                  <FiCheck className="text-brand" /> Location-based results
                </span>
                <span className="inline-flex items-center gap-2">
                  <FiCheck className="text-brand" /> Direct booking access
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="container-x relative z-10 -mt-7">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-line bg-white p-4 shadow-soft sm:p-5"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.7fr)_auto_auto] lg:items-end">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  Search garage
                </span>
                <span className="relative block">
                  <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Garage name, area or address"
                    className="h-12 w-full rounded-xl border border-line bg-bg-soft pl-10 pr-3 text-sm font-medium outline-none transition focus:border-ink focus:bg-white"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  City
                </span>
                <span className="relative block">
                  <FiMapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Enter city"
                    className="h-12 w-full rounded-xl border border-line bg-bg-soft pl-10 pr-3 text-sm font-medium outline-none transition focus:border-ink focus:bg-white"
                  />
                </span>
              </label>

              <button
                type="button"
                onClick={() => setOpenNow((value) => !value)}
                aria-pressed={openNow}
                className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${
                  openNow
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-ink hover:border-ink"
                }`}
              >
                <FiClock /> Open now
              </button>

              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-extrabold text-black transition hover:bg-brand-dark"
              >
                Search <FiArrowRight />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={requestCurrentLocation}
                disabled={locationLoading}
                className="inline-flex items-center gap-2 self-start text-sm font-bold text-ink transition hover:text-ink/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-ink">
                  <FiNavigation
                    className={locationLoading ? "animate-pulse" : ""}
                  />
                </span>
                {locationLoading
                  ? "Detecting your location"
                  : "Use my current location"}
              </button>

              {hasAppliedFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 self-start text-sm font-semibold text-muted transition hover:text-ink"
                >
                  <FiRefreshCw /> Reset filters
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="container-x py-8 sm:py-10 lg:py-12">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Garage directory
              </p>
              <h2 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
                {loading
                  ? "Finding verified garages"
                  : `${garages.length} verified garage${
                      garages.length === 1 ? "" : "s"
                    }`}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {activeLocation
                  ? `Within ${NEARBY_RADIUS_KM} km of your current location${
                      appliedFilters.city.trim()
                        ? ` in ${appliedFilters.city.trim()}`
                        : ""
                    }`
                  : appliedFilters.city.trim()
                    ? `Available partners in ${appliedFilters.city.trim()}`
                    : "All available verified garage partners"}
              </p>
            </div>

            {activeLocation && (
              <span className="inline-flex self-start items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-xs font-bold text-ink sm:self-auto">
                <FiNavigation className="text-green-600" /> Distance enabled
              </span>
            )}
          </div>

          {locationMessage && (
            <div className="mb-5 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-muted">
              {locationMessage}
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

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
            <div className="rounded-3xl border border-dashed border-line bg-white px-6 py-12 text-center sm:px-10">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-bg-soft text-2xl text-muted">
                <FiNavigation />
              </div>
              <h2 className="mt-5 text-2xl font-extrabold text-ink">
                No verified garages found
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Try a different city or remove the search filters. Rovauto may
                still be onboarding verified partners in this area.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink-2"
              >
                <FiRefreshCw /> Clear filters
              </button>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
