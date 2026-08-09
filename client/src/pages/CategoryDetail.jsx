import { useEffect, useRef, useState } from "react";
import {
  useParams,
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { CATEGORY_UI } from "@/data/services";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import ServicePriceDisplay from "@/components/services/ServicePriceDisplay";
import SafeImage from "@/components/common/SafeImage";
import api from "@/api/axios";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiDroplet,
  FiMapPin,
  FiSearch,
  FiSettings,
  FiSliders,
  FiTool,
  FiTruck,
  FiX,
} from "react-icons/fi";
import { useApp } from "@/hooks/useApp";
import Seo, { SITE_URL } from "@/components/seo/Seo";
import {
  getServiceCategoryPath,
  matchesServiceCategoryRoute,
} from "@/utils/serviceSlug";
import {
  getServiceMinPrice,
} from "@/utils/priceRange";
import {
  clearPendingServiceSelection,
  readPendingServiceSelection,
  savePendingServiceSelection,
} from "@/utils/bookingCart";
import {
  getCategoryThumbnailUrl,
  getOptimizedImageUrl,
  getServiceImageUrls,
  getServiceThumbnailUrl,
  warmImageCache,
} from "@/utils/imageCache";
import { loadActiveCities } from "@/utils/cityAvailability";
import {
  getServiceFulfillmentLabel,
  isSelfDropOffOnlyService,
} from "@/utils/serviceFulfillment";

const toBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true";

const getIncludes = (service) => {
  if (!service.description) return ["Service inspection", "Basic checks"];

  return service.description
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const GUEST_FUEL_TYPES = [
  { label: "Petrol", value: "PETROL" },
  { label: "Diesel", value: "DIESEL" },
  { label: "CNG", value: "CNG" },
  { label: "Hybrid", value: "HYBRID" },
  { label: "Other", value: "OTHER" },
];

export default function CategoryDetail() {
  const { categoryId } = useParams();
  const { user, vehicle, location, addToCart } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const nav = useNavigate();
  const guestCity = !user ? searchParams.get("city") || "" : "";
  const guestBrandId = !user ? searchParams.get("brand") || "" : "";
  const guestModelId = !user ? searchParams.get("model") || "" : "";
  const guestFuelType = !user ? searchParams.get("fuel") || "" : "";
  const guestPricingReady = Boolean(
    !user && guestCity && guestBrandId && guestModelId && guestFuelType,
  );
  const guestFilterSearch = (() => {
    const params = new URLSearchParams();
    if (guestCity) params.set("city", guestCity);
    if (guestBrandId) params.set("brand", guestBrandId);
    if (guestModelId) params.set("model", guestModelId);
    if (guestFuelType) params.set("fuel", guestFuelType);
    const value = params.toString();
    return value ? `?${value}` : "";
  })();

  const [category, setCategory] = useState(null);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState([]);
  const [brands, setBrands] = useState([]);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);
  const [filterOptionsError, setFilterOptionsError] = useState("");
  const [pricingError, setPricingError] = useState("");
  const [pricingLoading, setPricingLoading] = useState(false);
  const [cartNotice, setCartNotice] = useState("");
  const [guestFilterDraft, setGuestFilterDraft] = useState({
    city: guestCity,
    brand: guestBrandId,
    model: guestModelId,
    fuelType: guestFuelType,
  });
  const pendingServiceHandledRef = useRef(false);

  const selectedBrand = brands.find((brand) => brand.id === guestBrandId);
  const selectedModel = selectedBrand?.models?.find(
    (model) => model.id === guestModelId,
  );
  const selectedFuelType = GUEST_FUEL_TYPES.find(
    (fuelType) => fuelType.value === guestFuelType,
  );
  const draftBrand = brands.find(
    (brand) => brand.id === guestFilterDraft.brand,
  );
  const availableModels = Array.isArray(draftBrand?.models)
    ? draftBrand.models
    : [];
  const draftSelectedModel = availableModels.find(
    (model) => model.id === guestFilterDraft.model,
  );
  const allModelsSelected = guestModelId.toUpperCase() === "ALL";
  const guestFiltersActive = Boolean(
    !user && (guestCity || guestBrandId || guestModelId || guestFuelType),
  );
  const draftFiltersActive = Object.values(guestFilterDraft).some(Boolean);
  const draftFiltersComplete = Object.values(guestFilterDraft).every(Boolean);
  const draftFiltersChanged =
    guestFilterDraft.city !== guestCity ||
    guestFilterDraft.brand !== guestBrandId ||
    guestFilterDraft.model !== guestModelId ||
    guestFilterDraft.fuelType !== guestFuelType;

  const applyGuestFilters = () => {
    if (!draftFiltersComplete) return;

    const next = new URLSearchParams(searchParams);

    next.set("city", guestFilterDraft.city);
    next.set("brand", guestFilterDraft.brand);
    next.set("model", guestFilterDraft.model);
    next.set("fuel", guestFilterDraft.fuelType);

    setSearchParams(next, { replace: true });
  };

  const clearGuestFilters = () => {
    setGuestFilterDraft({ city: "", brand: "", model: "", fuelType: "" });

    const next = new URLSearchParams(searchParams);
    ["city", "brand", "model", "fuel"].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    setGuestFilterDraft({
      city: guestCity,
      brand: guestBrandId,
      model: guestModelId,
      fuelType: guestFuelType,
    });
  }, [guestBrandId, guestCity, guestFuelType, guestModelId]);

  useEffect(() => {
    if (user) return undefined;

    let cancelled = false;

    const loadFilterOptions = async () => {
      try {
        setFilterOptionsLoading(true);
        setFilterOptionsError("");

        const [cityList, brandResponse] = await Promise.all([
          loadActiveCities(),
          api.get("/vehicle-meta/brands"),
        ]);

        if (cancelled) return;

        setCities(Array.isArray(cityList) ? cityList : []);
        setBrands(
          Array.isArray(brandResponse.data?.data)
            ? brandResponse.data.data
            : [],
        );
      } catch (error) {
        if (!cancelled) {
          setFilterOptionsError(
            error.response?.data?.message ||
              "Price filters are temporarily unavailable.",
          );
        }
      } finally {
        if (!cancelled) setFilterOptionsLoading(false);
      }
    };

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const loadCategory = async () => {
      const isPriceRefresh = Boolean(category);

      try {
        if (isPriceRefresh) setPricingLoading(true);
        else setLoading(true);
        setPricingError("");

        const res = await api.get("/services/categories", {
          params: user
            ? {
                ...(vehicle?.id && { vehicleId: vehicle.id }),
                ...(location?.city && { city: location.city }),
              }
            : {
                ...(guestCity && { city: guestCity }),
                ...(guestBrandId && { vehicleBrandId: guestBrandId }),
                ...(guestModelId && { vehicleModelId: guestModelId }),
                ...(guestFuelType && { fuelType: guestFuelType }),
              },
        });
        const categories = res.data.data || [];

        const found = categories.find((item) =>
          matchesServiceCategoryRoute(item, categoryId),
        );

        if (cancelled) return;

        setCategory(found || null);
        setPackages(found?.services || []);
        if (found) warmImageCache(getServiceImageUrls([found]));
      } catch (err) {
        console.error("Failed to load category:", err);
        if (!cancelled) {
          setPricingError(
            err.response?.data?.message ||
              "We could not refresh prices for these filters.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setPricingLoading(false);
        }
      }
    };

    let cancelled = false;
    void loadCategory();

    return () => {
      cancelled = true;
    };
  }, [
    categoryId,
    user,
    vehicle?.id,
    location?.city,
    guestCity,
    guestBrandId,
    guestModelId,
    guestFuelType,
  ]);

  useEffect(() => {
    if (
      !user ||
      loading ||
      pricingLoading ||
      !category ||
      pendingServiceHandledRef.current
    ) {
      return;
    }

    const pendingSelection = readPendingServiceSelection();
    if (!pendingSelection) return;

    const currentCategoryPath = getServiceCategoryPath(category);
    const matchesCategory =
      !pendingSelection.categoryId ||
      pendingSelection.categoryId === category.id ||
      pendingSelection.returnLocation?.pathname === currentCategoryPath;

    if (!matchesCategory) return;

    pendingServiceHandledRef.current = true;
    clearPendingServiceSelection();

    const service = packages.find(
      (item) => item.id === pendingSelection.serviceId,
    );

    if (!service) {
      setCartNotice(
        "That service is no longer available. Please choose another service.",
      );
      return;
    }

    if (!service.priceRange) {
      setCartNotice(
        service.priceUnavailableMessage ||
          "This service is not priced for your selected vehicle and city.",
      );
      return;
    }

    addToCart({
      ...service,
      price: getServiceMinPrice(service),
      image: getServiceThumbnailUrl(service) || getCategoryThumbnailUrl(category),
      catId: category.id,
      category: {
        id: category.id,
        name: category.name,
        isComingSoon: toBoolean(category.isComingSoon),
      },
      categoryComingSoon: toBoolean(category.isComingSoon),
    });

    nav("/booking/services", {
      replace: true,
      state: { message: `${service.name} was added to your cart.` },
    });
  }, [
    addToCart,
    category,
    loading,
    nav,
    packages,
    pricingLoading,
    user,
  ]);

  if (loading) {
    return (
      <div className="container-x py-10">
        <div className="card-soft p-8 text-muted">Loading category...</div>
      </div>
    );
  }

  if (!category) {
    return <div className="container-x py-10">Category not found</div>;
  }

  const ui = CATEGORY_UI[category.name] || {};
  const categoryImage = getCategoryThumbnailUrl(category);
  const Icon = ui.icon || FiTool;
  const categoryComingSoon = toBoolean(category.isComingSoon);
  const selectedPackageComingSoon =
    selectedPackage &&
    (categoryComingSoon || toBoolean(selectedPackage.isComingSoon));
  const categoryPath = getServiceCategoryPath(category);
  const categoryDescription = `Book verified ${category.name.toLowerCase()} services with transparent pricing, garage assignment, live tracking and Rovauto service warranty.`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${category.name} services`,
      description: categoryDescription,
      url: `${SITE_URL}${categoryPath}`,
      provider: {
        "@type": "Organization",
        name: "Rovauto",
        url: SITE_URL,
      },
      areaServed: "India",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Services",
          item: `${SITE_URL}/services`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: category.name,
          item: `${SITE_URL}${categoryPath}`,
        },
      ],
    },
  ];

  const handleBook = (service) => {
    if (categoryComingSoon || toBoolean(service.isComingSoon)) {
      return;
    }

    if (!user) {
      const returnLocation = {
        pathname: categoryPath,
        search: guestFilterSearch,
      };

      savePendingServiceSelection({
        serviceId: service.id,
        categoryId: category.id,
        returnLocation,
      });

      nav("/login", {
        state: {
          from: returnLocation,
          message: "Sign in to add this service and continue booking.",
        },
      });
      return;
    }

    if (!service.priceRange) return;

    const serviceItem = {
      ...service,
      price: getServiceMinPrice(service),
      image: getServiceThumbnailUrl(service) || categoryImage,
      catId: category.id,
      category: {
        id: category.id,
        name: category.name,
        isComingSoon: categoryComingSoon,
      },
      categoryComingSoon,
    };

    const result = addToCart(serviceItem);

    setCartNotice("");
    nav("/booking/services");
  };

  return (
    <>
      <Seo
        title={`${category.name} Services`}
        description={categoryDescription}
        path={categoryPath}
        structuredData={structuredData}
      />

      <div className="container-x max-w-6xl py-8 2xl:max-w-[96rem]">
      <Link
        to="/services"
        className="mb-5 flex items-center gap-2 text-ink hover:opacity-80"
      >
        <FiArrowLeft /> Back to Services
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">{category.name}</h1>

        {categoryComingSoon && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
            Category Coming Soon
          </span>
        )}
      </div>

      {cartNotice && (
        <div
          role="alert"
          className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
        >
          <div className="flex items-start gap-2">
            <FiMapPin className="mt-1 shrink-0" aria-hidden="true" />
            <span>{cartNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setCartNotice("")}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full transition hover:bg-amber-100"
            aria-label="Dismiss booking notice"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
      )}

      {!user && (
        <section
          aria-labelledby="category-price-filter-heading"
          className="mb-5 overflow-hidden rounded-xl border border-gray-950 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:mb-6 sm:rounded-2xl"
        >
          <div className="flex items-start justify-between gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-6 sm:py-5">
            <div className="min-w-0 border-l-[3px] border-[#9fce00] pl-3 sm:pl-4">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#668500] sm:mb-1.5 sm:gap-2 sm:text-[11px] sm:tracking-[0.16em]">
                <FiSliders className="text-sm" aria-hidden="true" />
                Price preview
              </div>
              <div>
                <h2
                  id="category-price-filter-heading"
                  className="text-[15px] font-semibold leading-5 tracking-[-0.01em] text-gray-950 sm:text-lg"
                >
                  Service pricing for your vehicle
                </h2>
                <p className="mt-1 hidden max-w-2xl text-sm leading-5 text-gray-600 sm:block">
                  Select your location and vehicle to see relevant prices in
                  this category.
                </p>
              </div>
            </div>

            {(guestFiltersActive || draftFiltersActive) && (
              <button
                type="button"
                onClick={clearGuestFilters}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-[11px] font-semibold text-gray-700 transition hover:border-gray-950 hover:text-gray-950 sm:h-9 sm:gap-2 sm:px-3.5 sm:text-xs"
              >
                <FiX aria-hidden="true" /> Clear filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-y border-gray-200 bg-gray-50/80 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5 lg:grid-cols-4">
            <label className="block min-w-0">
              <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-600 sm:mb-2 sm:gap-2 sm:text-[11px] sm:tracking-[0.12em]">
                <FiMapPin className="text-gray-950" aria-hidden="true" /> City
              </span>
              <select
                value={guestFilterDraft.city}
                onChange={(event) =>
                  setGuestFilterDraft((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                disabled={filterOptionsLoading}
                className="h-10 w-full min-w-0 rounded-lg border border-gray-950 bg-white px-2 text-xs font-medium text-gray-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] outline-none transition focus:border-gray-950 focus:ring-[3px] focus:ring-[#b9f000]/25 disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-500 sm:h-12 sm:px-3.5 sm:text-sm"
              >
                <option value="">Select city</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-600 sm:mb-2 sm:gap-2 sm:text-[11px] sm:tracking-[0.12em]">
                <FiTruck className="text-gray-950" aria-hidden="true" /> Brand
              </span>
              <select
                value={guestFilterDraft.brand}
                onChange={(event) =>
                  setGuestFilterDraft((current) => ({
                    ...current,
                    brand: event.target.value,
                    model: "",
                  }))
                }
                disabled={filterOptionsLoading}
                className="h-10 w-full min-w-0 rounded-lg border border-gray-950 bg-white px-2 text-xs font-medium text-gray-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] outline-none transition focus:border-gray-950 focus:ring-[3px] focus:ring-[#b9f000]/25 disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-500 sm:h-12 sm:px-3.5 sm:text-sm"
              >
                <option value="">Select brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-600 sm:mb-2 sm:gap-2 sm:text-[11px] sm:tracking-[0.12em]">
                <FiSettings className="text-gray-950" aria-hidden="true" /> Model
              </span>
              <select
                value={guestFilterDraft.model}
                onChange={(event) =>
                  setGuestFilterDraft((current) => ({
                    ...current,
                    model: event.target.value,
                  }))
                }
                disabled={filterOptionsLoading || !guestFilterDraft.brand}
                className="h-10 w-full min-w-0 rounded-lg border border-gray-950 bg-white px-2 text-xs font-medium text-gray-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] outline-none transition focus:border-gray-950 focus:ring-[3px] focus:ring-[#b9f000]/25 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-500 sm:h-12 sm:px-3.5 sm:text-sm"
              >
                <option value="">
                  {guestFilterDraft.brand
                    ? "Select model"
                    : "Choose a brand first"}
                </option>
                {guestFilterDraft.brand && (
                  <option value="ALL">All models (generic prices only)</option>
                )}
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>

              {draftSelectedModel && (
                <div className="mt-2 hidden items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-2.5 sm:flex">
                  <SafeImage
                    src={getOptimizedImageUrl(draftSelectedModel.imageUrl, {
                      width: 180,
                    })}
                    alt={`${draftBrand?.name || "Vehicle"} ${draftSelectedModel.name}`}
                    width="180"
                    height="112"
                    loading="lazy"
                    className="h-14 w-20 shrink-0 rounded-md bg-white object-cover"
                    fallback={
                      <div className="grid h-14 w-20 shrink-0 place-items-center rounded-md bg-white text-xl text-gray-500">
                        <FiTruck />
                      </div>
                    }
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-gray-950">
                      {draftBrand?.name} {draftSelectedModel.name}
                    </div>
                    <div className="text-xs text-gray-600">
                      Selected model
                    </div>
                  </div>
                </div>
              )}
            </label>

            <label className="block min-w-0">
              <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-600 sm:mb-2 sm:gap-2 sm:text-[11px] sm:tracking-[0.12em]">
                <FiDroplet className="text-gray-950" aria-hidden="true" /> Fuel
                type
              </span>
              <select
                value={guestFilterDraft.fuelType}
                onChange={(event) =>
                  setGuestFilterDraft((current) => ({
                    ...current,
                    fuelType: event.target.value,
                  }))
                }
                disabled={filterOptionsLoading}
                className="h-10 w-full min-w-0 rounded-lg border border-gray-950 bg-white px-2 text-xs font-medium text-gray-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] outline-none transition focus:border-gray-950 focus:ring-[3px] focus:ring-[#b9f000]/25 disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-500 sm:h-12 sm:px-3.5 sm:text-sm"
              >
                <option value="">Select fuel type</option>
                {GUEST_FUEL_TYPES.map((fuelType) => (
                  <option key={fuelType.value} value={fuelType.value}>
                    {fuelType.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2.5 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
            <div
              className="flex min-h-0 min-w-0 items-start gap-2 text-xs sm:min-h-9 sm:items-center sm:gap-3 sm:text-sm"
              aria-live="polite"
            >
              {filterOptionsError || pricingError ? (
                <>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  <p className="font-medium text-red-700">
                    {filterOptionsError || pricingError}
                  </p>
                </>
              ) : (
                <>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      guestPricingReady && !draftFiltersChanged
                        ? "bg-[#86ad00]"
                        : "bg-gray-400"
                    }`}
                  />
                  {pricingLoading ? (
                    <p className="text-gray-600">Updating service prices...</p>
                  ) : draftFiltersChanged && draftFiltersComplete ? (
                    <p className="text-gray-600">
                      Filters are ready. Select Search prices to apply them.
                    </p>
                  ) : guestPricingReady && !draftFiltersChanged ? (
                    <p className="font-medium text-gray-700">
                      <span className="font-semibold text-gray-950">
                        Price context:
                      </span>{" "}
                      {selectedBrand?.name}{" "}
                      {allModelsSelected
                        ? "all models with generic pricing"
                        : selectedModel?.name}{" "}
                      · {selectedFuelType?.label} · {guestCity}
                    </p>
                  ) : (
                    <p className="text-gray-600">
                      Complete all four fields, then search for tailored prices.
                    </p>
                  )}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={applyGuestFilters}
              disabled={
                !draftFiltersComplete ||
                !draftFiltersChanged ||
                pricingLoading ||
                filterOptionsLoading
              }
              className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 sm:h-11 sm:w-auto sm:px-5"
            >
              <FiSearch
                className={pricingLoading ? "animate-pulse" : "text-[#b9f000]"}
                aria-hidden="true"
              />
              {pricingLoading ? "Searching..." : "Search prices"}
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-5">
        {packages.map((pkg) => {
          const serviceImage = getServiceThumbnailUrl(pkg);
          const hasPrice = Boolean(pkg.priceRange);
          const pricingContextActive = Boolean(user || guestPricingReady);
          const comingSoon =
            categoryComingSoon || toBoolean(pkg.isComingSoon);

          return (
            <article
              key={pkg.id}
              className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_6px_20px_rgba(15,23,42,0.05)] transition duration-300 hover:border-gray-300 hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)]"
            >
              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[124px_minmax(0,1fr)] sm:gap-4 sm:p-4 lg:grid-cols-[140px_minmax(0,1fr)_220px] lg:items-center">
                <button
                  type="button"
                  onClick={() => setSelectedPackage(pkg)}
                  className="relative h-24 w-24 overflow-hidden rounded-xl bg-bg-soft text-left sm:h-28 sm:w-full lg:h-28"
                  aria-label={`View details for ${pkg.name}`}
                >
                  <SafeImage
                    src={serviceImage}
                    alt={`${pkg.name} vehicle service`}
                    width="420"
                    height="320"
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-cover transition duration-500 ${
                      comingSoon
                        ? "scale-105 blur-sm grayscale"
                        : "group-hover:scale-[1.03]"
                    }`}
                    fallback={
                      <div className="grid h-full w-full place-items-center text-3xl text-muted">
                        <Icon />
                      </div>
                    }
                  />

                  {comingSoon && <ComingSoonOverlay compact />}
                </button>

                <div className="min-w-0 self-center">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h2 className="min-w-0 text-base font-black leading-tight tracking-tight text-ink sm:text-lg">
                      {pkg.name}
                    </h2>

                    {comingSoon && (
                      <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-800">
                        Coming soon
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold sm:text-xs">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      <FiCheckCircle className="shrink-0 text-sm" />
                      Verified service
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 ${
                        isSelfDropOffOnlyService(pkg)
                          ? "text-violet-700"
                          : "text-sky-700"
                      }`}
                    >
                      {isSelfDropOffOnlyService(pkg) ? (
                        <FiMapPin className="shrink-0 text-sm" />
                      ) : (
                        <FiTruck className="shrink-0 text-sm" />
                      )}
                      {getServiceFulfillmentLabel(pkg)}
                    </span>
                  </div>

                  <div className="mt-3 lg:hidden">
                    {hasPrice ? (
                      <ServicePriceDisplay
                        service={pkg}
                        regularClassName="whitespace-nowrap text-[11px] font-semibold text-red-500 line-through decoration-red-500"
                        currentClassName="whitespace-nowrap text-lg font-black leading-none tracking-tight text-gray-950"
                      />
                    ) : pricingContextActive && !comingSoon ? (
                      <p className="text-xs font-bold leading-4 text-amber-800">
                        {pkg.priceUnavailableMessage ||
                          "Price not allocated for this vehicle"}
                      </p>
                    ) : (
                      <p className="text-sm font-extrabold text-ink">
                        {comingSoon ? "Coming soon" : "Select vehicle for price"}
                      </p>
                    )}
                  </div>
                </div>

                <aside className="hidden min-w-0 border-l border-gray-100 pl-5 lg:flex lg:flex-col lg:gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-500">
                      Estimated price
                    </p>

                    {hasPrice ? (
                      <div className="mt-1.5">
                        <ServicePriceDisplay
                          service={pkg}
                          regularClassName="whitespace-nowrap text-xs font-semibold text-red-500 line-through decoration-red-500"
                          currentClassName="whitespace-nowrap text-xl font-black leading-none tracking-tight text-gray-950"
                        />
                      </div>
                    ) : pricingContextActive && !comingSoon ? (
                      <p className="mt-1.5 text-xs font-bold leading-4 text-amber-800">
                        {pkg.priceUnavailableMessage ||
                          "Price not allocated for this vehicle"}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm font-extrabold text-ink">
                        {comingSoon ? "Coming soon" : "Select vehicle for price"}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPackage(pkg)}
                      className="min-h-9 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs font-extrabold text-ink transition hover:border-gray-950 hover:bg-gray-50 active:scale-[0.98]"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBook(pkg)}
                      disabled={comingSoon || (pricingContextActive && !hasPrice)}
                      className="min-h-9 rounded-lg bg-[#b9f000] px-2.5 py-2 text-xs font-black text-gray-950 transition hover:bg-[#a9dc00] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {comingSoon
                        ? "Soon"
                        : !user
                          ? "Login"
                          : hasPrice
                            ? "Book"
                            : "Unavailable"}
                    </button>
                  </div>
                </aside>

                <div className="col-span-2 grid grid-cols-2 gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setSelectedPackage(pkg)}
                    className="min-h-9 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-extrabold text-ink transition hover:border-gray-950 hover:bg-gray-50 active:scale-[0.98] sm:text-sm"
                  >
                    View details
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBook(pkg)}
                    disabled={comingSoon || (pricingContextActive && !hasPrice)}
                    className="min-h-9 rounded-lg bg-[#b9f000] px-3 py-2 text-xs font-black text-gray-950 transition hover:bg-[#a9dc00] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  >
                    {comingSoon
                      ? "Coming Soon"
                      : !user
                        ? "Login to Book"
                        : hasPrice
                          ? "Book service"
                          : "Unavailable"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {packages.length === 0 && (
          <div className="card-soft p-8 text-muted">
            No services available in this category.
          </div>
        )}
      </div>

      {selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white">
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold">{selectedPackage.name}</h2>

                  {selectedPackageComingSoon && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                      Coming Soon
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setSelectedPackage(null)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-gray-300 transition hover:bg-gray-100"
                >
                  <FiX />
                </button>
              </div>

              <div className="relative mb-5 h-44 w-full overflow-hidden rounded-2xl bg-bg-soft">
                <SafeImage
                  src={getServiceThumbnailUrl(selectedPackage)}
                  alt={`${selectedPackage.name} service details`}
                  width="960"
                  height="540"
                  loading="lazy"
                  decoding="async"
                  className={`h-full w-full object-cover transition ${
                    selectedPackageComingSoon
                      ? "scale-105 blur-sm grayscale"
                      : ""
                  }`}
                  fallback={
                    <div className="grid h-full w-full place-items-center text-3xl text-muted">
                      <Icon />
                    </div>
                  }
                />

                {selectedPackageComingSoon && <ComingSoonOverlay />}
              </div>

              {selectedPackage.priceRange && (
                <ServicePriceDisplay
                  service={selectedPackage}
                  className="mb-3"
                  regularClassName="text-sm font-semibold text-red-500 line-through decoration-[1.5px] decoration-red-500"
                  currentClassName="text-2xl font-black tracking-tight text-ink"
                />
              )}

              {(user || guestPricingReady) &&
                !selectedPackage.priceRange &&
                !selectedPackageComingSoon && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                    {selectedPackage.priceUnavailableMessage ||
                      "Price not allocated for this vehicle"}
                  </div>
                )}

              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted text-sm">Verified service</span>
                </div>

                <div className="rounded-xl bg-yellow-100 px-3 py-1.5 text-sm font-medium text-yellow-800">
                  Popular service
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold ${
                    isSelfDropOffOnlyService(selectedPackage)
                      ? "border-violet-100 bg-violet-50 text-violet-800"
                      : "border-sky-100 bg-sky-50 text-sky-700"
                  }`}
                >
                  {isSelfDropOffOnlyService(selectedPackage) ? (
                    <FiMapPin />
                  ) : (
                    <FiTruck />
                  )}
                  {getServiceFulfillmentLabel(selectedPackage)}
                </span>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm text-muted">Warranty</span>
                  <div className="font-semibold">Available</div>
                </div>

                <div>
                  <span className="text-sm text-muted">Services Coverage</span>
                  <div className="font-semibold">
                    {getIncludes(selectedPackage).length}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-muted">Estimated Price</span>
                  <div className="font-semibold">
                    {selectedPackage.priceRange ? (
                      <ServicePriceDisplay
                        service={selectedPackage}
                        regularClassName="text-xs font-semibold text-red-500 line-through decoration-[1.5px] decoration-red-500"
                        currentClassName="text-base font-black text-ink"
                      />
                    ) : user || guestPricingReady ? (
                      selectedPackage.priceUnavailableMessage ||
                      "Price not allocated for this vehicle"
                    ) : (
                      "Select city, car and model to view pricing"
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <h3 className="mb-3 text-lg font-bold">Services Coverage</h3>

                <ul className="grid gap-2">
                  {getIncludes(selectedPackage).map((item, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 rounded-xl bg-bg-soft px-3 py-2 text-sm"
                    >
                      <span className="h-2 w-2 rounded-full bg-brand" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setSelectedPackage(null)}
                  className="flex-1 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-bold transition hover:bg-gray-50"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    handleBook(selectedPackage);
                    setSelectedPackage(null);
                  }}
                  disabled={
                    selectedPackageComingSoon ||
                    ((user || guestPricingReady) &&
                      !selectedPackage.priceRange)
                  }
                  className="flex-1 rounded-lg bg-[#b9f000] px-5 py-2.5 text-sm font-bold shadow-[0_10px_40px_-10px_rgba(185,240,0,0.55)] transition hover:bg-[#9bd000] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selectedPackageComingSoon
                    ? "Coming Soon"
                    : !user
                      ? "Login to Book"
                      : selectedPackage.priceRange
                        ? "Book Now"
                        : "Price unavailable"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
