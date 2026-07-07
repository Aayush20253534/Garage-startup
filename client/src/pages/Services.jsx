import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_UI } from "@/data/services";
import {
  FiSearch,
  FiArrowRight,
  FiSettings,
} from "react-icons/fi";
import { useApp } from "@/hooks/useApp";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import {
  getCategoryThumbnailUrl,
  getServiceImageUrls,
  warmImageCache,
} from "@/utils/imageCache";
import { getServiceMinPrice } from "@/utils/priceRange";
import Seo, { SITE_URL } from "@/components/seo/Seo";
import { getServiceCategoryPath } from "@/utils/serviceSlug";

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
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const { cart, fetchServiceCategories } = useApp();
  const cartItems = Array.isArray(cart) ? cart : [];

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchServiceCategories();

        setCategories(data || []);
        warmImageCache(getServiceImageUrls(data || []));
      } catch (error) {
        console.error(
          "Failed to load service categories:",
          error,
        );
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [fetchServiceCategories]);

  const filteredCategories = (
    q
      ? categories.filter((category) =>
          category.name
            .toLowerCase()
            .includes(q.toLowerCase()),
        )
      : categories
  ).filter(
    (category) =>
      ![
        "Brake",
        "Cleaning",
        "Electrical",
        "Emergency",
        "Engine",
        "General Service",
        "Tyre",
        "Tyres",
        "Battery",
        "AC",
      ].includes(category.name),
  );

  const cartTotal = cartItems.reduce(
    (total, item) =>
      total + getServiceMinPrice(item),
    0,
  );

  const structuredData = [
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
      itemListElement: categories.map((category, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: category.name,
        url: `${SITE_URL}${getServiceCategoryPath(category)}`,
      })),
    },
  ];

  return (
    <>
      <Seo
        title="Vehicle Repair and Maintenance Services"
        description="Explore verified vehicle repair, maintenance, detailing and roadside service options with transparent pricing on Rovauto."
        path="/services"
        structuredData={structuredData}
      />

      <div className="container-x py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">
            All Services
          </h1>

          <p className="mt-2 text-muted">
            Curated for your vehicle. Transparent pricing.
          </p>
        </div>

        <div className="relative w-full max-w-md">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />

          <input
            value={q}
            onChange={(event) =>
              setQ(event.target.value)
            }
            placeholder="Search categories"
            className="w-full rounded-full border border-line py-3 pl-11 pr-4 outline-none focus:border-[#b9f000]"
          />
        </div>
      </div>

      <section aria-labelledby="service-categories-heading">
        <h2 id="service-categories-heading" className="sr-only">
          Vehicle service categories
        </h2>

      {loading ? (
        <div className="card-soft p-8 text-muted">
          Loading services...
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
          {filteredCategories.map((category) => {
            const ui =
              CATEGORY_UI[category.name] || {};

            const Icon = ui.icon || FiSettings;

            const image =
              getCategoryThumbnailUrl(category);

            const comingSoon =
              isCategoryComingSoon(category);

            const destination = ui.isSos
              ? "/sos"
              : getServiceCategoryPath(category);

            return (
              <Link
                key={category.id}
                to={comingSoon ? "#" : destination}
                onClick={(event) => {
                  if (comingSoon) {
                    event.preventDefault();
                  }
                }}
                aria-disabled={comingSoon}
                className={`flex h-[250px] flex-col overflow-hidden rounded-3xl bg-white p-4 shadow-lg transition-all sm:h-auto sm:p-5 ${
                  comingSoon
                    ? "cursor-not-allowed"
                    : "cursor-pointer hover:-translate-y-1 hover:shadow-xl"
                }`}
              >
                <div className="mb-3 flex min-h-[52px] flex-wrap items-start gap-2 text-xl font-bold leading-tight sm:mb-4 sm:min-h-0">
                  <span>{category.name}</span>

                  {comingSoon && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                      Coming Soon
                    </span>
                  )}
                </div>

                <div className="relative mt-auto h-32 w-full overflow-hidden rounded-2xl bg-bg-soft">
                  {image ? (
                    <img
                      src={image}
                      alt={`${category.name} vehicle service category`}
                      width="640"
                      height="360"
                      loading="lazy"
                      decoding="async"
                      className={`h-full w-full object-cover transition duration-300 ${
                        comingSoon
                          ? "scale-105 blur-sm grayscale"
                          : "hover:scale-105"
                      }`}
                    />
                  ) : (
                    <div
                      className={`grid h-full w-full place-items-center text-3xl text-muted ${
                        comingSoon
                          ? "blur-[1px] grayscale"
                          : ""
                      }`}
                    >
                      <Icon />
                    </div>
                  )}

                  {comingSoon && (
                    <ComingSoonOverlay compact />
                  )}
                </div>
              </Link>
            );
          })}

          {filteredCategories.length === 0 && (
            <div className="card-soft p-8 text-muted">
              No service categories found.
            </div>
          )}
        </div>
      )}
      </section>

      {cartItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <Link
            to="/checkout"
            className="btn-dark px-6 py-3.5 shadow-2xl"
          >
            {cartItems.length} service
            {cartItems.length > 1 ? "s" : ""} · ₹{" "}
            {cartTotal} · Continue <FiArrowRight />
          </Link>
        </div>
      )}
      </div>
    </>
  );
}
