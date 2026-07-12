import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CATEGORY_UI } from "@/data/services";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import SafeImage from "@/components/common/SafeImage";
import api from "@/api/axios";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiLayers,
  FiShield,
  FiStar,
  FiTool,
  FiX,
} from "react-icons/fi";
import { useApp } from "@/hooks/useApp";
import Seo, { SITE_URL } from "@/components/seo/Seo";
import {
  getServiceCategoryPath,
  matchesServiceCategoryRoute,
} from "@/utils/serviceSlug";
import {
  formatServicePriceRange,
  getServiceMinPrice,
  getServiceMaxPrice,
} from "@/utils/priceRange";
import {
  getCategoryThumbnailUrl,
  getServiceImageUrls,
  getServiceThumbnailUrl,
  warmImageCache,
} from "@/utils/imageCache";

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

export default function CategoryDetail() {
  const { categoryId } = useParams();
  const { user, vehicle, location, addToCart } = useApp();

  const nav = useNavigate();

  const [category, setCategory] = useState(null);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategory = async () => {
      try {
        setLoading(true);

        const res = await api.get("/services/categories", {
          params: user
            ? {
                ...(vehicle?.id && { vehicleId: vehicle.id }),
                ...(location?.city && { city: location.city }),
              }
            : {},
        });
        const categories = res.data.data || [];

        const found = categories.find((item) =>
          matchesServiceCategoryRoute(item, categoryId),
        );

        setCategory(found || null);
        setPackages(found?.services || []);
        if (found) warmImageCache(getServiceImageUrls([found]));
      } catch (err) {
        console.error("Failed to load category:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCategory();
  }, [categoryId, user, vehicle?.id, location?.city]);

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
      nav("/login");
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

    addToCart(serviceItem);
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

      <div className="container-x max-w-6xl py-8">
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

      <div className="grid gap-4">
        {packages.map((pkg) => {
          const priceRange = formatServicePriceRange(pkg);
          const minPrice = getServiceMinPrice(pkg);
          const maxPrice = getServiceMaxPrice(pkg);
          const includes = getIncludes(pkg);
          const serviceImage = getServiceThumbnailUrl(pkg);
          const hasPrice = Boolean(user && pkg.priceRange);
          const comingSoon =
            categoryComingSoon || toBoolean(pkg.isComingSoon);

          return (
            <article
              key={pkg.id}
              className="overflow-hidden rounded-[26px] border border-gray-100 bg-white p-3 shadow-[0_12px_36px_rgba(15,23,42,0.08)] sm:p-5 sm:shadow-lg"
            >
              <div className="flex flex-col gap-0 md:flex-row md:gap-5">
                <div className="relative aspect-[16/10] w-full flex-shrink-0 overflow-hidden rounded-[20px] bg-bg-soft md:h-44 md:w-56 md:rounded-2xl">
                  <SafeImage
                    src={serviceImage}
                    alt={`${pkg.name} vehicle service`}
                    width="640"
                    height="420"
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-cover transition ${
                      comingSoon ? "scale-105 blur-sm grayscale" : ""
                    }`}
                    fallback={
                      <div className="grid h-full w-full place-items-center text-4xl text-muted">
                        <Icon />
                      </div>
                    }
                  />

                  {comingSoon && <ComingSoonOverlay />}
                </div>

                <div className="min-w-0 flex-1 pt-4 md:pt-0">
                  {/* Compact mobile card */}
                  <div className="md:hidden">
                    <div className="mb-3 flex items-start justify-between gap-3 px-1">
                      <h2 className="min-w-0 text-[1.3rem] font-extrabold leading-tight tracking-tight text-ink">
                        {pkg.name}
                      </h2>

                      {comingSoon && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                          Coming soon
                        </span>
                      )}
                    </div>

                    {hasPrice && (
                      <div className="mb-3 px-1">
                        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                          <span className="whitespace-nowrap text-[1.55rem] font-extrabold leading-none tracking-tight text-ink">
                            {priceRange}
                          </span>

                          {maxPrice > minPrice && (
                            <span className="pb-0.5 text-xs font-medium text-muted">
                              Estimated range
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {user && !hasPrice && !comingSoon && (
                      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold leading-5 text-amber-800">
                        {pkg.priceUnavailableMessage ||
                          "Price not allocated for this vehicle"}
                      </div>
                    )}

                    <div className="mb-3 flex flex-wrap gap-2 px-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700">
                        <FiCheckCircle className="text-sm" />
                        Verified
                      </span>

                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700">
                        <FiStar className="text-sm" />
                        Popular
                      </span>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          <FiShield className="text-sm" />
                          Warranty
                        </div>
                        <div className="text-sm font-bold text-ink">
                          Available
                        </div>
                      </div>

                      <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          <FiLayers className="text-sm" />
                          Included
                        </div>
                        <div className="text-sm font-bold text-ink">
                          {includes.length} service
                          {includes.length === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPackage(pkg)}
                        className="min-h-12 rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm font-bold text-ink transition active:scale-[0.98]"
                      >
                        Details
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBook(pkg)}
                        disabled={comingSoon || (user && !hasPrice)}
                        className="min-h-12 rounded-2xl bg-[#b9f000] px-3 py-3 text-sm font-extrabold text-gray-950 shadow-[0_10px_28px_-12px_rgba(185,240,0,0.9)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {comingSoon
                          ? "Coming Soon"
                          : !user
                            ? "Login to Book"
                            : hasPrice
                              ? "Book"
                              : "Unavailable"}
                      </button>
                    </div>
                  </div>

                  {/* Existing desktop card */}
                  <div className="hidden md:block">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold sm:text-2xl">
                        {pkg.name}
                      </h2>

                      {comingSoon && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                          Coming Soon
                        </span>
                      )}
                    </div>

                    {hasPrice && (
                      <div className="mb-2 flex items-baseline gap-3">
                        <span className="text-2xl font-bold text-ink">
                          {priceRange}
                        </span>

                        {maxPrice > minPrice && (
                          <span className="text-base text-muted">
                            estimated range
                          </span>
                        )}
                      </div>
                    )}

                    {user && !hasPrice && !comingSoon && (
                      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                        {pkg.priceUnavailableMessage ||
                          "Price not allocated for this vehicle"}
                      </div>
                    )}

                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-sm text-muted">
                        Verified service
                      </span>
                    </div>

                    <div className="mb-4 inline-block rounded-xl bg-yellow-100 px-3 py-1.5 text-sm font-medium text-yellow-800">
                      Popular service
                    </div>

                    <ul className="mb-5 space-y-2">
                      <li className="flex items-start gap-2 text-base">
                        <span className="font-bold text-ink">Warranty:</span>
                        <span className="text-muted">
                          Service warranty available
                        </span>
                      </li>

                      <li className="flex items-start gap-2 text-base">
                        <span className="font-bold text-ink">Services:</span>
                        <span className="text-muted">
                          {includes.length} included
                        </span>
                      </li>
                    </ul>

                    <div className="my-4 border-t border-dashed border-gray-200" />

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setSelectedPackage(pkg)}
                        className="flex-1 rounded-2xl border border-gray-300 px-6 py-3 text-base font-bold transition hover:bg-gray-50"
                      >
                        View Details
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBook(pkg)}
                        disabled={comingSoon || (user && !hasPrice)}
                        className="flex-1 rounded-2xl bg-[#b9f000] px-6 py-3 text-base font-bold shadow-[0_10px_40px_-10px_rgba(185,240,0,0.55)] transition hover:bg-[#9bd000] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {comingSoon
                          ? "Coming Soon"
                          : !user
                            ? "Login to Book"
                            : hasPrice
                              ? "Book"
                              : "Price unavailable"}
                      </button>
                    </div>
                  </div>
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

              {user && selectedPackage.priceRange && (
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-ink">
                    {formatServicePriceRange(selectedPackage)}
                  </span>
                </div>
              )}

              {user &&
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
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm text-muted">Warranty</span>
                  <div className="font-semibold">Available</div>
                </div>

                <div>
                  <span className="text-sm text-muted">Services Included</span>
                  <div className="font-semibold">
                    {getIncludes(selectedPackage).length}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-muted">Estimated Price</span>
                  <div className="font-semibold">
                    {user
                      ? selectedPackage.priceRange
                        ? formatServicePriceRange(selectedPackage)
                        : selectedPackage.priceUnavailableMessage ||
                          "Price not allocated for this vehicle"
                      : "Login to view pricing"}
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <h3 className="mb-3 text-lg font-bold">Included Services</h3>

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
                  className="flex-1 rounded-full border border-gray-300 px-6 py-3 font-bold transition hover:bg-gray-50"
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
                    (user && !selectedPackage.priceRange)
                  }
                  className="flex-1 rounded-full bg-[#b9f000] px-6 py-3 font-bold shadow-[0_10px_40px_-10px_rgba(185,240,0,0.55)] transition hover:bg-[#9bd000] disabled:cursor-not-allowed disabled:opacity-50"
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
