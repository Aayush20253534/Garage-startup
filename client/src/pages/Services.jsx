import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowRight,
  FiSearch,
  FiSettings,
} from "react-icons/fi";

import { CATEGORY_UI } from "@/data/services";
import { useApp } from "@/hooks/useApp";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import SafeImage from "@/components/common/SafeImage";
import { getCategoryThumbnailUrl } from "@/utils/imageCache";
import {
  formatRupees,
  getServiceMinPrice,
} from "@/utils/priceRange";
import Seo, { SITE_URL } from "@/components/seo/Seo";
import { getServiceCategoryPath } from "@/utils/serviceSlug";

const HIDDEN_CATEGORIES = new Set([
  "brake",
  "cleaning",
  "electrical",
  "emergency",
  "engine",
  "general service",
  "tyre",
  "tyres",
  "battery",
  "ac",
]);

const isCategoryComingSoon = (category) => {
  if (category?.isComingSoon === true) {
    return true;
  }

  const services = Array.isArray(category?.services)
    ? category.services
    : [];

  return (
    services.length > 0 &&
    services.every(
      (service) => service?.isComingSoon === true,
    )
  );
};

export default function Services() {
  const {
    user,
    vehicle,
    location,
    cart,
    serviceCategoriesCache,
    fetchServiceCategories,
  } = useApp();

  const hasCachedCategories = Array.isArray(serviceCategoriesCache);

  const [q, setQ] = useState("");
  const [categories, setCategories] = useState(() =>
    hasCachedCategories ? serviceCategoriesCache : [],
  );
  const [loading, setLoading] = useState(!hasCachedCategories);

  const cartItems = Array.isArray(cart) ? cart : [];

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      if (!Array.isArray(serviceCategoriesCache)) {
        setLoading(true);
      }

      try {
        const data = await fetchServiceCategories();

        if (cancelled) {
          return;
        }

        setCategories(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(
          "Failed to load service categories:",
          error,
        );

        if (!cancelled && !Array.isArray(serviceCategoriesCache)) {
          setCategories([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadCategories();

    return () => {
      cancelled = true;
    };

    // Refetch only when the response's pricing/restriction context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, vehicle?.id, location?.city]);

  const filteredCategories = useMemo(() => {
    const searchQuery = q.trim().toLowerCase();

    return categories.filter((category) => {
      const categoryName =
        typeof category?.name === "string"
          ? category.name.trim()
          : "";

      if (!categoryName) {
        return false;
      }

      if (
        HIDDEN_CATEGORIES.has(
          categoryName.toLowerCase(),
        )
      ) {
        return false;
      }

      if (!searchQuery) {
        return true;
      }

      return categoryName
        .toLowerCase()
        .includes(searchQuery);
    });
  }, [categories, q]);

  const serviceById = useMemo(() => {
    const map = new Map();

    categories.forEach((category) => {
      const services = Array.isArray(
        category?.services,
      )
        ? category.services
        : [];

      services.forEach((service) => {
        if (service?.id) {
          map.set(service.id, service);
        }
      });
    });

    return map;
  }, [categories]);

  const hasUnavailableCartItems = useMemo(
    () =>
      Boolean(user) &&
      cartItems.some((item) => {
        const service = serviceById.get(item.id);

        return !service?.priceRange;
      }),
    [user, cartItems, serviceById],
  );

  const cartTotal = useMemo(
    () =>
      cartItems.reduce((total, item) => {
        const service =
          serviceById.get(item.id) || item;

        return (
          total + getServiceMinPrice(service)
        );
      }, 0),
    [cartItems, serviceById],
  );

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "Vehicle repair and maintenance booking",
        description:
          "Browse vehicle repair, maintenance, detailing and roadside service categories available through Rovauto.",
        provider: {
          "@type": "Organization",
          name: "Rovauto",
          url: SITE_URL,
        },
        areaServed: "India",
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Rovauto vehicle service categories",
        itemListElement: categories.map(
          (category, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: category.name,
            url: `${SITE_URL}${getServiceCategoryPath(
              category,
            )}`,
          }),
        ),
      },
    ],
    [categories],
  );

  return (
    <>
      <Seo
        title="Vehicle Repair and Maintenance Services"
        description="Explore verified vehicle repair, maintenance, detailing and roadside service options with transparent pricing on Rovauto."
        path="/services"
        structuredData={structuredData}
      />

      <main
        className={`container-x pt-6 sm:pt-10 ${
          cartItems.length > 0
            ? "pb-32 sm:pb-36"
            : "pb-10"
        }`}
      >
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-muted sm:text-sm">
                Vehicle care
              </p>

              <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                All Services
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-muted sm:text-base">
                Curated services for your vehicle
                with clear, transparent pricing.
              </p>
            </div>

            <div className="relative w-full lg:max-w-md">
              <FiSearch
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-lg text-muted"
              />

              <input
                type="search"
                value={q}
                onChange={(event) =>
                  setQ(event.target.value)
                }
                placeholder="Search service categories"
                aria-label="Search service categories"
                autoComplete="off"
                className="h-12 w-full rounded-2xl border border-line bg-white pl-11 pr-4 text-sm text-gray-950 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[#9dcf00] focus:ring-4 focus:ring-[#b9f000]/15 sm:rounded-full sm:text-base"
              />
            </div>
          </div>
        </header>

        <section
          aria-labelledby="service-categories-heading"
        >
          <h2
            id="service-categories-heading"
            className="sr-only"
          >
            Vehicle service categories
          </h2>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4">
              {Array.from({ length: 6 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-2xl border border-line/70 bg-white p-3 shadow-sm sm:rounded-3xl sm:p-5"
                  >
                    <div className="mb-4 h-5 w-3/4 rounded-full bg-bg-soft" />

                    <div className="aspect-[4/3] w-full rounded-xl bg-bg-soft sm:aspect-[16/10] sm:rounded-2xl" />
                  </div>
                ),
              )}
            </div>
          ) : filteredCategories.length > 0 ? (
            <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4">
              {filteredCategories.map(
                (category) => {
                  const ui =
                    CATEGORY_UI[category.name] ||
                    {};

                  const Icon =
                    ui.icon || FiSettings;

                  const image =
                    getCategoryThumbnailUrl(
                      category,
                    );

                  const comingSoon =
                    isCategoryComingSoon(category);

                  const destination = ui.isSos
                    ? "/sos"
                    : getServiceCategoryPath(
                        category,
                      );

                  return (
                    <Link
                      key={category.id}
                      to={
                        comingSoon
                          ? "#"
                          : destination
                      }
                      onClick={(event) => {
                        if (comingSoon) {
                          event.preventDefault();
                        }
                      }}
                      aria-disabled={comingSoon}
                      tabIndex={
                        comingSoon ? -1 : 0
                      }
                      className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition duration-200 sm:rounded-3xl sm:p-5 ${
                        comingSoon
                          ? "cursor-not-allowed opacity-90"
                          : "cursor-pointer active:scale-[0.98] sm:hover:-translate-y-1 sm:hover:border-[#b9f000]/40 sm:hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                      }`}
                    >
                      <div className="mb-3 flex min-h-[68px] min-w-0 flex-col items-start gap-2 sm:mb-4 sm:min-h-[60px]">
                        <h3 className="line-clamp-2 break-words text-base font-bold leading-snug text-gray-950 sm:text-lg">
                          {category.name}
                        </h3>

                        {comingSoon && (
                          <span className="inline-flex max-w-full rounded-full bg-amber-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-800 sm:px-2.5 sm:text-[10px]">
                            Coming soon
                          </span>
                        )}
                      </div>

                      <div className="relative mt-auto aspect-[4/3] w-full overflow-hidden rounded-xl bg-bg-soft sm:aspect-[16/10] sm:rounded-2xl">
                        <SafeImage
                          src={image}
                          alt={`${category.name} vehicle service category`}
                          width="640"
                          height="480"
                          loading="lazy"
                          decoding="async"
                          className={`h-full w-full object-cover transition duration-300 ${
                            comingSoon
                              ? "scale-105 blur-sm grayscale"
                              : "group-hover:scale-105"
                          }`}
                          fallback={
                            <div
                              className={`grid h-full w-full place-items-center text-3xl text-muted sm:text-4xl ${
                                comingSoon
                                  ? "blur-[1px] grayscale"
                                  : ""
                              }`}
                            >
                              <Icon />
                            </div>
                          }
                        />

                        {!comingSoon && (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        )}

                        {comingSoon && (
                          <ComingSoonOverlay
                            compact
                          />
                        )}
                      </div>
                    </Link>
                  );
                },
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-bg-soft px-5 py-10 text-center sm:rounded-3xl sm:py-14">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-xl text-muted shadow-sm">
                <FiSearch />
              </div>

              <h3 className="mt-4 text-base font-bold text-gray-950 sm:text-lg">
                No service categories found
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted">
                Try searching with a different
                category name.
              </p>
            </div>
          )}
        </section>
      </main>

      {cartItems.length > 0 && (
        <div
          className="fixed inset-x-0 z-40 px-3 sm:px-4"
          style={{
            bottom:
              "max(1rem, env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto w-full max-w-xl">
            <Link
              to={
                hasUnavailableCartItems
                  ? "/booking/services"
                  : "/checkout"
              }
              className="flex min-h-[60px] w-full items-center justify-between gap-3 rounded-2xl bg-gray-950 px-4 py-3 text-white shadow-[0_18px_50px_rgba(15,23,42,0.35)] transition active:scale-[0.99] sm:min-h-[64px] sm:rounded-full sm:px-6"
            >
              {hasUnavailableCartItems ? (
                <>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold sm:text-base">
                      Review unavailable services
                    </span>

                    <span className="mt-0.5 block text-xs text-white/65">
                      Some prices are not
                      allocated
                    </span>
                  </span>

                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
                    <FiArrowRight />
                  </span>
                </>
              ) : (
                <>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-white/65 sm:text-sm">
                      {cartItems.length} service
                      {cartItems.length > 1
                        ? "s"
                        : ""}{" "}
                      selected
                    </span>

                    <span className="mt-0.5 block truncate text-sm font-bold sm:text-base">
                      {formatRupees(cartTotal)} ·
                      Continue
                    </span>
                  </span>

                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#b9f000] text-gray-950">
                    <FiArrowRight />
                  </span>
                </>
              )}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}