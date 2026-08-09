import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_UI } from "@/data/services";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import ServicePriceDisplay from "@/components/services/ServicePriceDisplay";
import SafeImage from "@/components/common/SafeImage";
import {
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
  getServiceFulfillmentLabel,
  isSelfDropOffOnlyService,
} from "@/utils/serviceFulfillment";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiMapPin,
  FiMinus,
  FiPlus,
  FiSettings,
  FiShoppingBag,
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

const getServiceIncludes = (service) => {
  if (!service?.description) return ["Service inspection", "Basic checks"];

  return service.description
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

function CartItems({ cart, serviceById, comingSoonIds, removeFromCart }) {
  if (cart.length === 0) {
    return <p className="text-sm text-muted">No services added yet.</p>;
  }

  return (
    <div className="grid gap-2">
      {cart.map((item) => {
        const currentService = serviceById.get(item.id);
        const displayItem = currentService || item;
        const unavailable = !currentService?.priceRange;
        const comingSoon =
          isCartItemComingSoon(displayItem) || comingSoonIds.has(item.id);

        return (
          <div
            key={item.id}
            className="rounded-xl border border-line bg-white p-3 text-sm"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">
                  {displayItem.name}
                </span>

                {comingSoon && (
                  <span className="mt-1 block text-xs font-semibold text-amber-700">
                    Coming Soon
                  </span>
                )}

                {unavailable && !comingSoon && (
                  <span className="mt-1 block text-xs font-semibold leading-4 text-red-700">
                    {currentService?.priceUnavailableMessage ||
                      "Unavailable for this city or vehicle"}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeFromCart(item.id)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-700"
                aria-label={`Remove ${displayItem.name}`}
              >
                <FiX />
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
              <span
                className={`inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[10px] font-extrabold leading-none ${
                  isSelfDropOffOnlyService(displayItem)
                    ? "border-violet-100 bg-violet-50 text-violet-800"
                    : "border-sky-100 bg-sky-50 text-sky-700"
                }`}
              >
                {isSelfDropOffOnlyService(displayItem) ? <FiMapPin /> : <FiTruck />}
                {getServiceFulfillmentLabel(displayItem)}
              </span>

              {currentService?.priceRange && (
                <ServicePriceDisplay
                  service={currentService}
                  className="ml-auto flex-col items-end gap-x-0 gap-y-0.5 text-right"
                  regularClassName="text-[10px] font-semibold leading-none text-red-500 line-through decoration-[1.5px] decoration-red-500"
                  currentClassName="whitespace-nowrap text-sm font-black leading-none text-ink"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ServiceSelect() {
  const {
    user,
    vehicle,
    location,
    cart,
    setCart,
    addToCart,
    removeFromCart,
  } = useApp();

  const [categories, setCategories] = useState([]);
  const [catId, setCatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

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

  const checkoutBlocked =
    cart.length === 0 ||
    hasComingSoonInCart ||
    hasUnavailableInCart;

  const checkoutLabel =
    cart.length === 0
      ? "Add service"
      : hasComingSoonInCart || hasUnavailableInCart
        ? "Review cart"
        : "Continue";

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
        const currentServiceById = new Map(
          data.flatMap((category) =>
            (category.services || []).map((service) => [
              service.id,
              {
                ...service,
                catId: category.id,
                category: {
                  id: category.id,
                  name: category.name,
                  isComingSoon: toBoolean(category.isComingSoon),
                },
                categoryComingSoon: toBoolean(category.isComingSoon),
              },
            ]),
          ),
        );

        setCart((current) =>
          current.map((item) => {
            const refreshedService = currentServiceById.get(item.id);
            if (!refreshedService) return item;

            return {
              ...item,
              ...refreshedService,
              price: refreshedService.priceRange
                ? getServiceMinPrice(refreshedService)
                : item.price,
              image:
                getServiceThumbnailUrl(refreshedService) || item.image,
            };
          }),
        );

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
  }, [user, vehicle?.id, location?.city, setCart]);

  useEffect(() => {
    if (cart.length === 0) {
      setMobileCartOpen(false);
    }
  }, [cart.length]);

  if (loading) {
    return (
      <div className="container-x py-12">
        <div className="card-soft p-8 text-muted">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="container-x pb-36 pt-6 sm:pt-10 lg:py-12">
      <div className="mb-2 flex items-center gap-3">
        <span className="chip-brand">Step 2 of 3</span>
      </div>

      <h1 className="text-2xl font-bold leading-tight sm:text-4xl">
        Pick services for your{" "}
        {vehicle ? `${vehicle.brand} ${vehicle.model}` : "vehicle"}
      </h1>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted sm:text-base">
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

      <div className="mt-6 grid gap-4 lg:mt-8 lg:grid-cols-[260px_1fr_320px] lg:gap-6 2xl:grid-cols-[300px_minmax(0,1fr)_360px] 2xl:gap-8">
        <aside className="-mx-5 overflow-x-auto border-y border-line bg-white px-5 py-3 shadow-sm lg:mx-0 lg:sticky lg:top-24 lg:h-fit lg:overflow-visible lg:rounded-[1.25rem] lg:border lg:p-3 lg:shadow-soft">
          <div className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:gap-1">
            {categories.map((category) => {
              const ui = CATEGORY_UI[category.name] || {};
              const Icon = ui.icon || FiSettings;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCatId(category.id)}
                  className={`flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition ${
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

        <div className="grid gap-3 sm:gap-4">
          {list.map((service) => {
            const inCart = cart.some((item) => item.id === service.id);
            const hasPrice = Boolean(service.priceRange);
            const comingSoon =
              toBoolean(selectedCategory?.isComingSoon) ||
              toBoolean(service.isComingSoon);
            const serviceImage = getServiceThumbnailUrl(service);

            const toggleService = () => {
              if (inCart) {
                removeFromCart(service.id);
                return;
              }

              if (comingSoon) return;

              const result = addToCart({
                ...service,
                category: {
                  id: selectedCategory?.id,
                  name: selectedCategory?.name,
                  isComingSoon: toBoolean(selectedCategory?.isComingSoon),
                },
                categoryComingSoon: toBoolean(selectedCategory?.isComingSoon),
              });

              if (result?.added || result?.alreadyInCart) {
                setError("");
              }
            };

            const actionLabel = inCart
              ? "Remove"
              : comingSoon
                ? "Coming Soon"
                : !hasPrice
                  ? "Unavailable"
                  : "Add";

            return (
              <article
                key={service.id}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${service.name}`}
                onClick={() =>
                  setSelectedService({
                    service,
                    comingSoon,
                  })
                }
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedService({ service, comingSoon });
                  }
                }}
                className="card-soft cursor-pointer overflow-hidden p-3 transition hover:border-gray-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 sm:grid sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-start sm:gap-4 sm:p-4"
              >
                <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 sm:contents">
                  <div className="relative h-[88px] w-[88px] overflow-hidden rounded-xl bg-bg-soft sm:h-24 sm:w-28">
                    <SafeImage
                      src={serviceImage}
                      alt={service.name}
                      width="420"
                      height="320"
                      loading="lazy"
                      decoding="async"
                      className={`h-full w-full object-cover transition ${
                        comingSoon ? "scale-105 blur-sm grayscale" : ""
                      }`}
                      fallback={
                        <div className="grid h-full w-full place-items-center text-2xl text-muted">
                          <FiSettings />
                        </div>
                      }
                    />

                    {comingSoon && <ComingSoonOverlay compact />}
                  </div>

                  <div className="min-w-0 self-start">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <h3 className="min-w-0 text-base font-black leading-tight tracking-tight text-ink sm:text-lg">
                        {service.name}
                      </h3>

                      {comingSoon && (
                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-800 sm:hidden">
                          Soon
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-bold sm:text-xs">
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <FiCheck className="shrink-0 text-xs sm:text-sm" />
                        Verified service
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 ${
                          isSelfDropOffOnlyService(service)
                            ? "text-violet-700"
                            : "text-sky-700"
                        }`}
                      >
                        {isSelfDropOffOnlyService(service) ? (
                          <FiMapPin className="shrink-0 text-xs sm:text-sm" />
                        ) : (
                          <FiTruck className="shrink-0 text-xs sm:text-sm" />
                        )}
                        {getServiceFulfillmentLabel(service)}
                      </span>
                    </div>

                    <div className="mt-2 flex min-w-0 items-end justify-between gap-2 sm:hidden">
                      <div className="min-w-0">
                        {comingSoon ? (
                          <div className="text-sm font-extrabold leading-tight text-ink">
                            Coming Soon
                          </div>
                        ) : hasPrice ? (
                          <ServicePriceDisplay
                            service={service}
                            className="justify-start"
                            regularClassName="whitespace-nowrap text-[9px] font-semibold leading-none text-red-500 line-through decoration-[1.5px] decoration-red-500"
                            currentClassName="whitespace-nowrap text-[13px] font-black leading-none tracking-tight text-ink min-[390px]:text-sm"
                          />
                        ) : (
                          <div className="max-w-28 text-[10px] font-bold leading-3.5 text-amber-700">
                            {service.priceUnavailableMessage || "Price unavailable"}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        aria-pressed={inCart}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleService();
                        }}
                        disabled={(!hasPrice && !inCart) || (comingSoon && !inCart)}
                        className={`inline-flex h-8 min-w-[3.75rem] shrink-0 items-center justify-center gap-1 rounded-md px-2.5 text-[11px] font-extrabold shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                          inCart
                            ? "bg-ink text-white hover:bg-ink-2"
                            : comingSoon
                              ? "bg-amber-100 text-amber-800"
                              : "bg-brand text-black shadow-brand/20 hover:bg-brand-dark"
                        }`}
                      >
                        {inCart ? <FiMinus /> : !comingSoon && hasPrice ? <FiPlus /> : null}
                        {actionLabel}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="hidden min-w-[10.5rem] border-l border-line pl-4 sm:flex sm:flex-col sm:items-end sm:gap-3 sm:text-right">
                  <div className="min-w-0">
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
                      Estimated price
                    </div>
                    {comingSoon ? (
                      <div className="mt-1 text-base font-extrabold leading-tight text-ink">
                        Coming Soon
                      </div>
                    ) : hasPrice ? (
                      <ServicePriceDisplay
                        service={service}
                        className="mt-1 justify-end"
                        regularClassName="whitespace-nowrap text-[10px] font-semibold text-red-500 line-through decoration-[1.5px] decoration-red-500"
                        currentClassName="whitespace-nowrap text-lg font-black leading-none tracking-tight text-ink"
                      />
                    ) : (
                      <div className="mt-1 max-w-40 text-xs font-bold leading-4 text-amber-700">
                        {service.priceUnavailableMessage ||
                          "Price not allocated for this vehicle"}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    aria-pressed={inCart}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleService();
                    }}
                    disabled={(!hasPrice && !inCart) || (comingSoon && !inCart)}
                    className={`inline-flex h-8 min-w-[5.25rem] shrink-0 items-center justify-center gap-1 rounded-md px-2.5 text-[11px] font-extrabold shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                      inCart
                        ? "bg-ink text-white hover:bg-ink-2"
                        : comingSoon
                          ? "bg-amber-100 text-amber-800"
                          : "bg-brand text-black shadow-brand/20 hover:bg-brand-dark"
                    }`}
                  >
                    {inCart ? <FiMinus /> : !comingSoon && hasPrice ? <FiPlus /> : null}
                    {actionLabel}
                  </button>
                </div>
              </article>
            );
          })}

          {list.length === 0 && (
            <div className="card-soft p-8 text-muted">
              No services found in this category.
            </div>
          )}
        </div>

        <aside className="card-soft hidden h-fit p-5 lg:sticky lg:top-24 lg:block">
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

          <CartItems
            cart={cart}
            serviceById={serviceById}
            comingSoonIds={comingSoonIds}
            removeFromCart={removeFromCart}
          />

          <hr className="my-4 border-line" />

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <span className="text-muted">Estimated</span>
            <span className="whitespace-nowrap text-right text-lg font-bold sm:text-xl">
              {formatRupeeRange(totalMin, totalMax)}
            </span>
          </div>

          <Link
            to="/checkout"
            aria-disabled={checkoutBlocked}
            className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark ${
              checkoutBlocked ? "pointer-events-none opacity-50 grayscale" : ""
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-12px_36px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
        <div className="mx-auto max-w-2xl">
          {mobileCartOpen && cart.length > 0 && (
            <section
              id="mobile-service-cart"
              aria-label="Selected services"
              className="mb-3 max-h-[42dvh] overflow-y-auto rounded-2xl border border-line bg-bg-soft p-3 shadow-xl"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-ink">Your Cart ({cart.length})</h2>
                  <p className="text-xs text-muted">
                    Review or remove selected services.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileCartOpen(false)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-white text-muted"
                  aria-label="Close cart"
                >
                  <FiX />
                </button>
              </div>

              {(hasComingSoonInCart || hasUnavailableInCart) && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  <FiAlertCircle className="mt-0.5 shrink-0" />
                  <span>
                    Remove unavailable or coming-soon services before continuing.
                  </span>
                </div>
              )}

              <CartItems
                cart={cart}
                serviceById={serviceById}
                comingSoonIds={comingSoonIds}
                removeFromCart={removeFromCart}
              />
            </section>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileCartOpen((current) => !current)}
              disabled={cart.length === 0}
              aria-expanded={mobileCartOpen}
              aria-controls="mobile-service-cart"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left disabled:cursor-default"
            >
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
                <FiShoppingBag />
                {cart.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-extrabold text-black">
                    {cart.length}
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-muted">
                  {cart.length > 0 ? "Your Cart" : "No services selected"}
                </span>
                <span className="block truncate text-base font-extrabold leading-5 text-ink">
                  {formatRupeeRange(totalMin, totalMax)}
                </span>
              </span>

              {cart.length > 0 && (
                mobileCartOpen ? (
                  <FiChevronDown className="shrink-0 text-muted" />
                ) : (
                  <FiChevronUp className="shrink-0 text-muted" />
                )
              )}
            </button>

            <Link
              to="/checkout"
              aria-disabled={checkoutBlocked}
              onClick={(event) => {
                if (!checkoutBlocked) return;

                event.preventDefault();
                if (cart.length > 0) setMobileCartOpen(true);
              }}
              className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold transition ${
                checkoutBlocked
                  ? "bg-slate-200 text-slate-500"
                  : "bg-brand text-black shadow-sm shadow-brand/30 active:scale-[0.98]"
              }`}
            >
              {checkoutLabel}
              {cart.length > 0 && <FiArrowRight />}
            </Link>
          </div>
        </div>
      </div>

      {selectedService && (() => {
        const service = selectedService.service;
        const comingSoon = selectedService.comingSoon;
        const inCart = cart.some((item) => item.id === service.id);
        const hasPrice = Boolean(service.priceRange);
        const includes = getServiceIncludes(service);

        const toggleSelectedService = () => {
          if (inCart) {
            removeFromCart(service.id);
            return;
          }

          if (comingSoon || !hasPrice) return;

          const category = categories.find((item) =>
            (item.services || []).some((candidate) => candidate.id === service.id),
          );
          const result = addToCart({
            ...service,
            category: category
              ? {
                  id: category.id,
                  name: category.name,
                  isComingSoon: toBoolean(category.isComingSoon),
                }
              : service.category,
            categoryComingSoon: toBoolean(category?.isComingSoon),
          });

          if (result?.added || result?.alreadyInCart) {
            setError("");
          }
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-stretch justify-center bg-white sm:items-center sm:bg-black/50 sm:p-4 sm:backdrop-blur-sm"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedService(null);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="booking-service-detail-title"
              className="h-[100dvh] max-h-[100dvh] w-full overflow-y-auto bg-white shadow-2xl sm:h-auto sm:max-h-[88vh] sm:max-w-xl sm:rounded-3xl"
            >
              <div className="p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2
                      id="booking-service-detail-title"
                      className="text-xl font-black leading-tight text-ink"
                    >
                      {service.name}
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-bold">
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <FiCheck />
                        Verified service
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 ${
                          isSelfDropOffOnlyService(service)
                            ? "text-violet-700"
                            : "text-sky-700"
                        }`}
                      >
                        {isSelfDropOffOnlyService(service) ? <FiMapPin /> : <FiTruck />}
                        {getServiceFulfillmentLabel(service)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedService(null)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink transition hover:bg-bg-soft"
                    aria-label="Close service details"
                  >
                    <FiX />
                  </button>
                </div>

                <div className="relative mb-4 h-44 overflow-hidden rounded-2xl bg-bg-soft sm:h-52">
                  <SafeImage
                    src={getServiceThumbnailUrl(service)}
                    alt={`${service.name} service details`}
                    width="960"
                    height="540"
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
                  {comingSoon && <ComingSoonOverlay />}
                </div>

                <div className="mb-4 rounded-2xl border border-line bg-bg-soft/60 p-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    Estimated price
                  </div>
                  <div className="mt-1.5">
                    {comingSoon ? (
                      <div className="font-extrabold text-ink">Coming Soon</div>
                    ) : hasPrice ? (
                      <ServicePriceDisplay
                        service={service}
                        regularClassName="text-xs font-semibold text-red-500 line-through decoration-[1.5px] decoration-red-500"
                        currentClassName="text-2xl font-black leading-none tracking-tight text-ink"
                      />
                    ) : (
                      <div className="text-sm font-bold text-amber-700">
                        {service.priceUnavailableMessage ||
                          "Price not allocated for this vehicle"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-line p-3">
                    <div className="text-xs text-muted">Warranty</div>
                    <div className="mt-0.5 font-bold text-ink">Available</div>
                  </div>
                  <div className="rounded-xl border border-line p-3">
                    <div className="text-xs text-muted">Services coverage</div>
                    <div className="mt-0.5 font-bold text-ink">
                      {includes.length} included items
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.08em] text-muted">
                    Service includes
                  </h3>
                  <ul className="mt-2 grid gap-2">
                    {includes.map((item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className="flex items-start gap-2 rounded-xl bg-bg-soft px-3 py-2 text-sm text-ink"
                      >
                        <FiCheck className="mt-0.5 shrink-0 text-emerald-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="sticky bottom-0 -mx-4 mt-5 flex gap-2 border-t border-line bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-5 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setSelectedService(null)}
                    className="h-10 flex-1 rounded-xl border border-line px-4 text-sm font-extrabold text-ink"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    aria-pressed={inCart}
                    onClick={toggleSelectedService}
                    disabled={(!hasPrice && !inCart) || (comingSoon && !inCart)}
                    className={`h-10 flex-1 rounded-xl px-4 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      inCart
                        ? "bg-ink text-white"
                        : comingSoon
                          ? "bg-amber-100 text-amber-800"
                          : "bg-brand text-black"
                    }`}
                  >
                    {inCart
                      ? "Remove service"
                      : comingSoon
                        ? "Coming Soon"
                        : hasPrice
                          ? "Add service"
                          : "Unavailable"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        );
      })()}
    </div>
  );
}
