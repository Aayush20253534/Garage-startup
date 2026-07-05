import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_UI } from "@/data/services";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import {
  formatServicePriceRange,
  getServiceMinPrice,
  getServiceMaxPrice,
} from "@/utils/priceRange";
import {
  getServiceImageUrls,
  getServiceThumbnailUrl,
  warmImageCache,
} from "@/utils/imageCache";
import {
  FiArrowRight,
  FiCheck,
  FiMinus,
  FiPlus,
  FiSettings,
  FiTruck,
} from "react-icons/fi";

export default function ServiceSelect() {
  const { user, vehicle, location, cart, addToCart, removeFromCart } = useApp();

  const [categories, setCategories] = useState([]);
  const [catId, setCatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedCategory = categories.find((category) => category.id === catId);
  const list = selectedCategory?.services || [];

  const comingSoonIds = useMemo(
    () =>
      new Set(
        categories
          .flatMap((category) => category.services || [])
          .filter((service) => service.isComingSoon)
          .map((service) => service.id),
      ),
    [categories],
  );

  const hasComingSoonInCart = cart.some(
    (item) => item.isComingSoon || comingSoonIds.has(item.id),
  );

  const totalMin = cart.reduce(
    (sum, item) => sum + getServiceMinPrice(item),
    0,
  );

  const totalMax = cart.reduce(
    (sum, item) => sum + getServiceMaxPrice(item),
    0,
  );

  useEffect(() => {
    const loadServices = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/services/categories", {
          params: user
            ? {
                ...(vehicle?.id && { vehicleId: vehicle.id }),
                ...(location?.city && { city: location.city }),
              }
            : {},
        });

        const data = res.data.data || [];

        setCategories(data);
        warmImageCache(getServiceImageUrls(data));

        if (data.length > 0) {
          setCatId((current) =>
            data.some((category) => category.id === current)
              ? current
              : data[0].id,
          );
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load services");
      } finally {
        setLoading(false);
      }
    };

    loadServices();
  }, [user, vehicle?.id, location?.city]);

  if (loading) {
    return (
      <div className="container-x py-12">
        <div className="card-soft p-8 text-muted">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="container-x py-12">
      <div className="mb-2 flex items-center gap-3">
        <span className="chip-brand">Step 2 of 3</span>
      </div>

      <h1 className="text-3xl font-bold sm:text-4xl">
        Pick services for your{" "}
        {vehicle ? `${vehicle.brand} ${vehicle.model}` : "vehicle"}
      </h1>

      <p className="mt-2 text-muted">
        Add multiple services. Nearby garages will receive your request after
        checkout.
      </p>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {hasComingSoonInCart && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          One or more services in your cart are now coming soon. Remove them
          before continuing.
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr_320px]">
        <aside className="card-soft h-fit p-3 lg:sticky lg:top-24">
          <div className="grid gap-1">
            {categories.map((category) => {
              const ui = CATEGORY_UI[category.name] || {};
              const Icon = ui.icon || FiSettings;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCatId(category.id)}
                  className={`flex h-10 items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition ${
                    catId === category.id
                      ? "bg-ink text-white shadow-sm"
                      : "text-ink hover:bg-bg-soft"
                  }`}
                >
                  <Icon
                    className="shrink-0 text-base"
                    style={{
                      color: catId === category.id ? "#b9f000" : ui.color,
                    }}
                  />
                  <span className="min-w-0 truncate">{category.name}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="grid gap-4">
          {list.map((service) => {
            const inCart = cart.some((item) => item.id === service.id);
            const priceRange = formatServicePriceRange(service);
            const hasPrice = Boolean(service.priceRange);
            const comingSoon = Boolean(service.isComingSoon);
            const serviceImage = getServiceThumbnailUrl(service);
            const duration = service.durationMin
              ? `${service.durationMin} min`
              : "Duration varies";

            return (
              <div
                key={service.id}
                className="card-soft flex flex-col gap-5 p-5 sm:flex-row sm:items-start"
              >
                <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-2xl bg-bg-soft sm:h-32 sm:w-40">
                  {serviceImage ? (
                    <img
                      src={serviceImage}
                      alt={service.name}
                      className={`h-full w-full object-cover transition ${
                        comingSoon ? "scale-105 blur-sm grayscale" : ""
                      }`}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-3xl text-muted">
                      <FiSettings />
                    </div>
                  )}

                  {comingSoon && <ComingSoonOverlay compact />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip">{duration}</span>

                    {comingSoon && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                        Coming Soon
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-lg font-semibold">{service.name}</h3>

                  <p className="mt-1 text-sm text-muted">
                    {service.description ||
                      "Service details available at checkout."}
                  </p>

                  <ul className="mt-3 grid gap-1.5 text-sm">
                    {(service.description || "")
                      .split(",")
                      .slice(0, 5)
                      .map((item) => item.trim())
                      .filter(Boolean)
                      .map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <FiCheck className="shrink-0 text-brand-dark" />
                          {item}
                        </li>
                      ))}
                  </ul>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 text-right sm:w-44 sm:flex-col sm:items-end">
                  <div>
                    <div className="text-xs text-muted">Estimated</div>
                    <div className="whitespace-nowrap text-lg font-bold leading-tight sm:text-xl">
                      {comingSoon
                        ? "Coming Soon"
                        : hasPrice
                          ? priceRange
                          : "Not configured"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (inCart) {
                        removeFromCart(service.id);
                        return;
                      }

                      if (!comingSoon) {
                        addToCart(service);
                      }
                    }}
                    disabled={(!hasPrice && !inCart) || (comingSoon && !inCart)}
                    className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      inCart
                        ? "bg-ink text-white hover:bg-ink-2"
                        : comingSoon
                          ? "bg-amber-100 text-amber-800"
                          : "bg-brand text-black shadow-brand/25 hover:bg-brand-dark"
                    }`}
                  >
                    {inCart ? (
                      <>
                        <FiMinus />
                        Remove
                      </>
                    ) : comingSoon ? (
                      "Coming Soon"
                    ) : (
                      <>
                        <FiPlus />
                        Add
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {list.length === 0 && (
            <div className="card-soft p-8 text-muted">
              No services found in this category.
            </div>
          )}
        </div>

        <aside className="card-soft h-fit p-5 lg:sticky lg:top-24">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand">
              <FiTruck />
            </span>

            <div className="text-sm">
              <div className="font-semibold">
                {vehicle?.brand} {vehicle?.model}
              </div>
              <div className="text-xs text-muted">
                {vehicle?.fuelType || "Vehicle selected"}
              </div>
            </div>
          </div>

          <hr className="my-4 border-line" />

          <div className="mb-2 font-semibold">Your Cart ({cart.length})</div>

          {cart.length === 0 ? (
            <p className="text-sm text-muted">No services added yet.</p>
          ) : (
            <div className="grid gap-2">
              {cart.map((item) => {
                const comingSoon =
                  item.isComingSoon || comingSoonIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="block truncate">{item.name}</span>
                      {comingSoon && (
                        <span className="text-xs font-semibold text-amber-700">
                          Coming Soon
                        </span>
                      )}
                    </div>

                    <span className="whitespace-nowrap text-right text-xs font-semibold sm:text-sm">
                      {item.priceRange ? formatServicePriceRange(item) : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <hr className="my-4 border-line" />

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <span className="text-muted">Estimated</span>
            <span className="whitespace-nowrap text-right text-lg font-bold sm:text-xl">
              ₹{totalMin} - ₹{totalMax}
            </span>
          </div>

          <Link
            to="/checkout"
            aria-disabled={cart.length === 0 || hasComingSoonInCart}
            className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark ${
              cart.length === 0 || hasComingSoonInCart
                ? "pointer-events-none opacity-50 grayscale"
                : ""
            }`}
          >
            {hasComingSoonInCart ? "Remove Coming Soon Items" : "Continue"}{" "}
            <FiArrowRight />
          </Link>
        </aside>
      </div>
    </div>
  );
}
