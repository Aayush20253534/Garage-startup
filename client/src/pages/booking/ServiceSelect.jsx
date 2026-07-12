import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_UI } from "@/data/services";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import SafeImage from "@/components/common/SafeImage";
import {
  formatServicePriceRange,
  formatRupeeRange,
  getServiceMinPrice,
  getServiceMaxPrice,
} from "@/utils/priceRange";
import {
  getServiceImageUrls,
  getServiceThumbnailUrl,
  warmImageCache,
} from "@/utils/imageCache";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheck,
  FiMinus,
  FiPlus,
  FiSettings,
  FiTruck,
  FiX,
} from "react-icons/fi";

const toBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true";

const isCartItemComingSoon = (item) =>
  toBoolean(item?.isComingSoon) ||
  toBoolean(item?.categoryComingSoon) ||
  toBoolean(item?.category?.isComingSoon);

export default function ServiceSelect() {
  const { user, vehicle, location, cart, addToCart, removeFromCart } = useApp();

  const [categories, setCategories] = useState([]);
  const [catId, setCatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedCategory = categories.find((category) => category.id === catId);
  const list = selectedCategory?.services || [];

  const serviceById = useMemo(
    () =>
      new Map(
        categories.flatMap((category) =>
          (category.services || []).map((service) => [service.id, service]),
        ),
      ),
    [categories],
  );

  const comingSoonIds = useMemo(
    () =>
      new Set(
        categories
          .flatMap((category) =>
            (category.services || [])
              .filter(
                (service) =>
                  toBoolean(category.isComingSoon) ||
                  toBoolean(service.isComingSoon),
              )
              .map((service) => service.id),
          ),
      ),
    [categories],
  );

  const hasComingSoonInCart = cart.some(
    (item) => isCartItemComingSoon(item) || comingSoonIds.has(item.id),
  );

  const hasUnavailableInCart = cart.some((item) => {
    const currentService = serviceById.get(item.id);
    return !currentService?.priceRange;
  });

  const pricedCartItems = cart
    .map((item) => serviceById.get(item.id))
    .filter((item) => item?.priceRange);

  const totalMin = pricedCartItems.reduce(
    (sum, item) => sum + getServiceMinPrice(item),
    0,
  );

  const totalMax = pricedCartItems.reduce(
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

      {hasUnavailableInCart && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span>
            A service in your cart is restricted in this city or has no price
            allocated for the selected vehicle. Remove it before continuing.
          </span>
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

                  {toBoolean(category.isComingSoon) && (
                    <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                      Soon
                    </span>
                  )}
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
            const comingSoon =
              toBoolean(selectedCategory?.isComingSoon) ||
              toBoolean(service.isComingSoon);
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
                  <SafeImage
                    src={serviceImage}
                    alt={service.name}
                    width="640"
                    height="420"
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-cover transition ${
                      comingSoon ? "scale-105 blur-sm grayscale" : ""
                    }`}
                    fallback={
                      <div className="grid h-full w-full place-items-center text-3xl text-muted">
                        <FiSettings />
                      </div>
                    }
                  />

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
                    <div
                      className={
                        hasPrice || comingSoon
                          ? "whitespace-nowrap text-lg font-bold leading-tight sm:text-xl"
                          : "max-w-44 text-sm font-bold leading-5 text-amber-700"
                      }
                    >
                      {comingSoon
                        ? "Coming Soon"
                        : hasPrice
                          ? priceRange
                          : service.priceUnavailableMessage ||
                            "Price not allocated for this vehicle"}
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
                        addToCart({
                          ...service,
                          category: {
                            id: selectedCategory?.id,
                            name: selectedCategory?.name,
                            isComingSoon: toBoolean(
                              selectedCategory?.isComingSoon,
                            ),
                          },
                          categoryComingSoon: toBoolean(
                            selectedCategory?.isComingSoon,
                          ),
                        });
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
                    ) : !hasPrice ? (
                      "Price unavailable"
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
                const currentService = serviceById.get(item.id);
                const displayItem = currentService || item;
                const unavailable = !currentService?.priceRange;
                const comingSoon =
                  isCartItemComingSoon(displayItem) ||
                  comingSoonIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-line px-2.5 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="block truncate">{displayItem.name}</span>
                      {comingSoon && (
                        <span className="block text-xs font-semibold text-amber-700">
                          Coming Soon
                        </span>
                      )}
                      {unavailable && !comingSoon && (
                        <span className="block text-xs font-semibold text-red-700">
                          {currentService?.priceUnavailableMessage ||
                            "Unavailable for this city or vehicle"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="whitespace-nowrap text-right text-xs font-semibold sm:text-sm">
                        {currentService?.priceRange
                          ? formatServicePriceRange(currentService)
                          : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-700"
                        aria-label={`Remove ${displayItem.name}`}
                      >
                        <FiX />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <hr className="my-4 border-line" />

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <span className="text-muted">Estimated</span>
            <span className="whitespace-nowrap text-right text-lg font-bold sm:text-xl">
              {formatRupeeRange(totalMin, totalMax)}
            </span>
          </div>

          <Link
            to="/checkout"
            aria-disabled={
              cart.length === 0 || hasComingSoonInCart || hasUnavailableInCart
            }
            className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark ${
              cart.length === 0 || hasComingSoonInCart || hasUnavailableInCart
                ? "pointer-events-none opacity-50 grayscale"
                : ""
            }`}
          >
            {hasComingSoonInCart
              ? "Remove Coming Soon Items"
              : hasUnavailableInCart
                ? "Remove Unavailable Items"
                : "Continue"}{" "}
            <FiArrowRight />
          </Link>
        </aside>
      </div>
    </div>
  );
}
