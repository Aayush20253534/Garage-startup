import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CATEGORY_UI } from "@/data/services";
import api from "@/api/axios";
import { FiStar, FiArrowLeft, FiX, FiTool } from "react-icons/fi";
import { useApp } from "@/hooks/useApp";
import {
  formatServicePriceRange,
  getServiceMinPrice,
  getServiceMaxPrice,
} from "@/utils/priceRange";

const getIncludes = (service) => {
  if (!service.description) return ["Service inspection", "Basic checks"];

  return service.description
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const getServiceThumbnail = (service) =>
  service?.media?.find((item) => item.isThumbnail)?.url ||
  service?.media?.[0]?.url ||
  "";

const getCategoryThumbnail = (category) =>
  (category?.services || []).map(getServiceThumbnail).find(Boolean) || "";

export default function CategoryDetail() {
  const { categoryId } = useParams();
  const { user, addToCart } = useApp();

  const nav = useNavigate();

  const [category, setCategory] = useState(null);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategory = async () => {
      try {
        setLoading(true);

        const res = await api.get("/services/categories");
        const categories = res.data.data || [];

        const found = categories.find((item) => item.id === categoryId);

        setCategory(found || null);
        setPackages(found?.services || []);
      } catch (err) {
        console.error("Failed to load category:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCategory();
  }, [categoryId]);

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
  const categoryImage = getCategoryThumbnail(category);
  const Icon = ui.icon || FiTool;

  const handleBook = (service) => {
    const serviceItem = {
      ...service,
      price: getServiceMinPrice(service),
      image: getServiceThumbnail(service) || categoryImage,
      catId: category.id,
    };

    addToCart(serviceItem);

    if (!user) {
      nav("/login");
    } else {
      nav("/booking/services");
    }
  };

  return (
    <div className="container-x max-w-6xl py-8">
      <Link
        to="/services"
        className="mb-5 flex items-center gap-2 text-ink hover:opacity-80"
      >
        <FiArrowLeft /> Back to Services
      </Link>

      <h1 className="mb-5 text-2xl font-bold sm:text-3xl">{category.name}</h1>

      <div className="grid gap-4">
        {packages.map((pkg) => {
          const priceRange = formatServicePriceRange(pkg);
          const minPrice = getServiceMinPrice(pkg);
          const maxPrice = getServiceMaxPrice(pkg);
          const includes = getIncludes(pkg);
          const serviceImage = getServiceThumbnail(pkg) || categoryImage;

          return (
            <div
              key={pkg.id}
              className="rounded-2xl bg-white p-4 shadow-lg sm:p-5"
            >
              <div className="flex flex-col gap-5 md:flex-row">
                <div className="h-40 w-full flex-shrink-0 overflow-hidden rounded-2xl bg-bg-soft md:h-44 md:w-56">
                  {serviceImage ? (
                    <img
                      src={serviceImage}
                      alt={pkg.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-4xl text-muted">
                      <Icon />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h2 className="mb-2 text-xl font-bold sm:text-2xl">
                    {pkg.name}
                  </h2>

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

                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <FiStar className="text-amber-400" fill="currentColor" />
                      <span className="font-semibold">4.8</span>
                    </div>

                    <span className="text-sm text-muted">Verified service</span>
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

                  <div className="my-4 border-t border-dashed border-gray-200"></div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => setSelectedPackage(pkg)}
                      className="flex-1 rounded-2xl border border-gray-300 px-6 py-3 text-base font-bold transition hover:bg-gray-50"
                    >
                      View Details
                    </button>

                    <button
                      onClick={() => handleBook(pkg)}
                      className="flex-1 rounded-2xl bg-[#b9f000] px-6 py-3 text-base font-bold shadow-[0_10px_40px_-10px_rgba(185,240,0,0.55)] transition hover:bg-[#9bd000]"
                    >
                      Book
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
                <h2 className="text-xl font-bold">{selectedPackage.name}</h2>

                <button
                  onClick={() => setSelectedPackage(null)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-gray-300 transition hover:bg-gray-100"
                >
                  <FiX />
                </button>
              </div>

              <div className="mb-5 h-44 w-full overflow-hidden rounded-2xl bg-bg-soft">
                {(getServiceThumbnail(selectedPackage) || categoryImage) ? (
                  <img
                    src={getServiceThumbnail(selectedPackage) || categoryImage}
                    alt={selectedPackage.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-3xl text-muted">
                    <Icon />
                  </div>
                )}
              </div>

              <div className="mb-3 flex items-baseline gap-3">
                <span className="text-2xl font-bold text-ink">
                  {formatServicePriceRange(selectedPackage)}
                </span>
              </div>

              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <FiStar className="text-amber-400" fill="currentColor" />
                  <span className="font-semibold">4.8</span>
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
                    {formatServicePriceRange(selectedPackage)}
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
                  className="flex-1 rounded-full bg-[#b9f000] px-6 py-3 font-bold shadow-[0_10px_40px_-10px_rgba(185,240,0,0.55)] transition hover:bg-[#9bd000]"
                >
                  Book Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
