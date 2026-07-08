import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FiArrowRight,
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
    service.basePrice,
    service.price,
  ].some((value) => value !== undefined && value !== null);

  return hasAnyPrice ? formatServicePriceRange(service) : "Custom quote";
};

const getGarageArea = (garage, fallbackCity = "") =>
  [garage?.area, garage?.city].filter(Boolean).join(", ") || fallbackCity || "Service area available";

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
  const distance = Number.isFinite(roadDistance) && roadDistance > 0 ? roadDistance : directDistance;

  if (!Number.isFinite(distance) || distance <= 0) return null;
  return `${distance.toFixed(distance >= 10 ? 0 : 1)} km away`;
};

const getUsableCoordinates = (value) => {
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
  const remainingServices = Math.max(services.length - shownServices.length, 0);
  const distance = formatDistance(garage);

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-white shadow-sm transition hover:border-ink/20 hover:shadow-soft">
      <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="relative h-56 bg-bg-soft lg:h-full">
          {image ? (
            <img
              src={image}
              alt={garage.name || "Garage"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full place-items-center bg-gradient-to-br from-slate-100 to-slate-200 text-5xl text-muted">
              <FiTool />
            </div>
          )}

          {garage.isVerified && (
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-white/50 bg-white/95 px-2.5 py-1.5 text-xs font-bold text-ink shadow-sm">
              <FiShield className="text-green-600" />
              Verified
            </span>
          )}
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold leading-tight text-ink">
                {garage.name || "Garage"}
              </h2>

              <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-muted">
                <FiMapPin className="mt-1 shrink-0" />
                <span>{getGarageAddress(garage, fallbackCity)}</span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-bg-soft px-3 py-2">
              <FiStar className="text-amber-500" fill="currentColor" />
              <div>
                <div className="text-sm font-bold text-ink">{formatRating(garage)}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {formatReviewCount(garage)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-line bg-bg-soft p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Hours</p>
              <p className="mt-1 font-bold text-ink">{formatHours(garage)}</p>
            </div>

            <div className="rounded-lg border border-line bg-bg-soft p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Working radius</p>
              <p className="mt-1 font-bold text-ink">{garage.workingRadiusKm || 15} km</p>
            </div>

            <div className="rounded-lg border border-line bg-bg-soft p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Distance</p>
              <p className="mt-1 font-bold text-ink">{distance || "Use location to see distance"}</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ink">Popular services</p>
              <p className="text-xs font-semibold text-muted">
                {services.length || "Multiple"} service{services.length === 1 ? "" : "s"}
              </p>
            </div>

            {shownServices.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {shownServices.map((item) => (
                  <div
                    key={item.id || item.serviceId || getServiceName(item)}
                    className="rounded-lg border border-line bg-white p-3"
                  >
                    <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-ink">
                      {getServiceName(item)}
                    </p>
                    <p className="mt-2 text-xs font-bold text-muted">{getServicePrice(item)}</p>
                  </div>
                ))}

                {remainingServices > 0 && (
                  <div className="rounded-lg border border-dashed border-line bg-bg-soft p-3 text-sm font-semibold text-muted">
                    +{remainingServices} more available
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-line bg-bg-soft p-4 text-sm text-muted">
                Services are not listed publicly yet. You can still book and Rovauto will match the request.
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-1 rounded-lg bg-bg-soft px-2.5 py-1.5">
                <FiClock /> {garage.isActive === false ? "Inactive" : "Accepting requests"}
              </span>
              {garage.whatsappLink && (
                <a
                  href={garage.whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-bg-soft px-2.5 py-1.5 transition hover:bg-brand-soft hover:text-ink"
                >
                  <FiPhone /> WhatsApp
                </a>
              )}
            </div>

            <Link
              to="/booking/vehicle"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-ink-2"
            >
              Book service <FiArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </article>
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
    () => getUsableCoordinates(browserLocation) || getUsableCoordinates(location),
    [
      browserLocation?.latitude,
      browserLocation?.longitude,
      location?.latitude,
      location?.longitude,
    ],
  );

  const requestParams = useMemo(
    () => ({
      verified: "true",
      ...(appliedFilters.city.trim() && { city: appliedFilters.city.trim() }),
      ...(appliedFilters.search.trim() && { search: appliedFilters.search.trim() }),
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
        if (!mounted || err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
        setGarages([]);
        setError(err.response?.data?.message || "Unable to load garages right now.");
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
        setLocationMessage(`Showing garages within ${NEARBY_RADIUS_KM} km of your current location.`);
        setLocationLoading(false);
      },
      () => {
        setLocationMessage("Allow location access to see nearby garages and distance.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <>
      <Seo
        title="Verified Garages in Prayagraj"
        description="Browse verified Rovauto garage partners with ratings, service coverage, hours and booking access."
        path="/garages"
      />

      <main className="bg-bg-soft">
        <section className="border-b border-line bg-white">
          <div className="container-x py-12 sm:py-16">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-bg-soft px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                <FiShield className="text-green-600" /> Verified partners
              </span>

              <h1 className="mt-4 text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
                Garages you can review before booking
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
                See Rovauto partner garages in a full page layout with location, ratings, service coverage and booking access. No cramped popups or tiny cards.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-8 grid gap-3 rounded-xl border border-line bg-bg-soft p-3 shadow-sm lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.7fr)_auto_auto]"
            >
              <label className="relative block">
                <span className="sr-only">Search garages</span>
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by garage, area or address"
                  className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-sm font-medium outline-none transition focus:border-ink"
                />
              </label>

              <label className="relative block">
                <span className="sr-only">City</span>
                <FiMapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="City"
                  className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-sm font-medium outline-none transition focus:border-ink"
                />
              </label>

              <button
                type="button"
                onClick={() => setOpenNow((value) => !value)}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition ${
                  openNow
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-ink hover:border-ink"
                }`}
              >
                <FiClock /> Open now
              </button>

              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-bold text-black transition hover:bg-brand-dark"
              >
                Apply <FiArrowRight />
              </button>
            </form>
          </div>
        </section>

        <section className="container-x py-8 sm:py-10">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-ink">
                {loading ? "Loading garages" : `${garages.length} verified garage${garages.length === 1 ? "" : "s"}`}
              </p>
              <p className="mt-1 text-sm text-muted">
                {activeLocation
                  ? `Showing garages within ${NEARBY_RADIUS_KM} km${appliedFilters.city.trim() ? ` in ${appliedFilters.city.trim()}` : ""}`
                  : appliedFilters.city.trim()
                    ? `Showing garages for ${appliedFilters.city.trim()}`
                    : "Showing all available verified garage partners"}
              </p>
              {locationMessage && (
                <p className="mt-1 text-xs font-semibold text-muted">{locationMessage}</p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={requestCurrentLocation}
                disabled={locationLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiNavigation className={locationLoading ? "animate-pulse" : ""} />
                {locationLoading ? "Detecting" : "Use my location"}
              </button>

              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink"
              >
                <FiRefreshCw /> Reset filters
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid gap-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-72 animate-pulse rounded-xl border border-line bg-white" />
              ))}
            </div>
          ) : garages.length > 0 ? (
            <div className="grid gap-5">
              {garages.map((garage) => (
                <GarageCard
                  key={garage.id}
                  garage={garage}
                  fallbackCity={appliedFilters.city}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-bg-soft text-xl text-muted">
                <FiNavigation />
              </div>
              <h2 className="mt-4 text-2xl font-bold text-ink">No verified garages found</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Try removing the city filter or search term. If your area is new, Rovauto may still be adding verified partners there.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-ink-2"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
