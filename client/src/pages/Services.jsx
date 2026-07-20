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
  }, [
    user?.id,
    vehicle?.id,
    location?.city,
  ]);

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

        <section aria-labelledby="services-catalogue-heading">
          <h2
            id="services-catalogue-heading"
            className="sr-only"
          >
            Vehicle service categories
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 sm:grid-cols-3 sm:gap-5 md:grid-cols-4">
              {Array.from({ length: 6 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-[24px] border border-line/70 bg-white p-3 shadow-sm min-[480px]:rounded-[22px] min-[480px]:p-2.5 sm:rounded-[28px] sm:p-3"
                  >
                    <div className="aspect-[16/10] w-full rounded-[18px] bg-bg-soft min-[480px]:aspect-[4/3] min-[480px]:rounded-[16px] sm:aspect-[16/10] sm:rounded-[22px]" />

                    <div className="px-1 pb-1 pt-4 min-[480px]:pt-3 sm:px-2 sm:pt-4">
                      <div className="h-5 w-4/5 rounded-full bg-bg-soft min-[480px]:h-4 sm:h-5" />
                      <div className="mt-2 hidden h-3 w-2/5 rounded-full bg-bg-soft sm:block" />
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : filteredCategories.length > 0 ? (
            <div className="grid grid-cols-1 items-start gap-4 min-[480px]:grid-cols-2 min-[480px]:gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4">
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
                      className={`group relative isolate flex min-w-0 flex-col overflow-hidden rounded-[24px] border bg-white p-3 shadow-[0_12px_34px_rgba(15,23,42,0.07)] transition duration-200 min-[480px]:rounded-[22px] min-[480px]:p-2.5 sm:rounded-[28px] sm:p-3 ${
                        comingSoon
                          ? "cursor-not-allowed border-gray-100 opacity-90"
                          : "cursor-pointer border-gray-100 active:scale-[0.985] sm:hover:-translate-y-1 sm:hover:border-[#b9f000]/50 sm:hover:shadow-[0_18px_46px_rgba(15,23,42,0.12)]"
                      }`}
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[18px] bg-bg-soft min-[480px]:aspect-[4/3] min-[480px]:rounded-[16px] sm:aspect-[16/10] sm:rounded-[22px]">
                        <SafeImage
                          src={image}
                          alt={`${category.name} vehicle service category`}
                          width="640"
                          height="480"
                          loading="lazy"
                          decoding="async"
                          className={`h-full w-full object-cover transition duration-500 ${
                            comingSoon
                              ? "scale-105 blur-sm grayscale"
                              : "group-hover:scale-[1.045]"
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
                          <>
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-70" />

                            <span className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-white/90 text-gray-950 shadow-sm backdrop-blur transition duration-200 group-hover:bg-[#b9f000] min-[480px]:right-2 min-[480px]:top-2 min-[480px]:h-8 min-[480px]:w-8 sm:right-3 sm:top-3 sm:h-9 sm:w-9">
                              <FiArrowRight className="-rotate-45 text-sm sm:text-base" />
                            </span>
                          </>
                        )}

                        {comingSoon && (
                          <ComingSoonOverlay compact />
                        )}
                      </div>

                      <div className="flex min-h-[76px] min-w-0 items-center px-1 pb-1 pt-4 min-[480px]:min-h-[58px] min-[480px]:pt-3 sm:min-h-[68px] sm:px-2 sm:pt-4">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 break-words text-lg font-bold leading-snug tracking-[-0.01em] text-gray-950 min-[480px]:text-[15px] min-[480px]:leading-[1.25] sm:text-lg sm:leading-snug">
                            {category.name}
                          </h3>

                          <p className="mt-1.5 text-sm font-medium text-muted min-[480px]:hidden sm:block sm:text-xs">
                            {comingSoon
                              ? "Coming soon"
                              : "View available services"}
                          </p>
                        </div>
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
                Try searching with a different category name.
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
              className="flex min-h-[54px] w-full items-center justify-between gap-3 rounded-lg bg-gray-950 px-4 py-2.5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.35)] transition active:scale-[0.99] sm:min-h-[56px] sm:px-5"
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
