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
  MIXED_FULFILLMENT_MESSAGE,
  getServiceFulfillmentLabel,
  hasMixedFulfillmentTypes,
  isSelfDropOffService,
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
                  isSelfDropOffService(displayItem)
                    ? "border-violet-100 bg-violet-50 text-violet-800"
                    : "border-sky-100 bg-sky-50 text-sky-700"
                }`}
              >
                {isSelfDropOffService(displayItem) ? <FiMapPin /> : <FiTruck />}
                {getServiceFulfillmentLabel(displayItem)}
              </span>

              {currentService?.priceRange && (
                <ServicePriceDisplay
                  service={currentService}
                  className="ml-auto flex-col items-end gap-x-0 gap-y-0.5 text-right"
                  regularClassName="text-[10px] font-bold leading-none text-red-500 line-through decoration-2 decoration-red-400/90"
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
  const { user, vehicle, location, cart, addToCart, removeFromCart } = useApp();

  const [categories, setCategories] = useState([]);
  const [catId, setCatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

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

  const hasMixedFulfillmentInCart = hasMixedFulfillmentTypes(
    cart.map((item) => serviceById.get(item.id) || item),
  );

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
    hasUnavailableInCart ||
    hasMixedFulfillmentInCart;

  const checkoutLabel =
    cart.length === 0
      ? "Add service"
      : hasComingSoonInCart ||
          hasUnavailableInCart ||
          hasMixedFulfillmentInCart
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

      {hasMixedFulfillmentInCart && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span>{MIXED_FULFILLMENT_MESSAGE}</span>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:mt-8 lg:grid-cols-[260px_1fr_320px] lg:gap-6">
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
            const duration = service.durationMin
              ? `${service.durationMin} min`
              : "Duration varies";
            const includedItems = (service.description || "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 5);
            const primaryItems = includedItems.slice(0, 3);
            const extraItems = includedItems.slice(3);

            return (
              <article
                key={service.id}
                className="card-soft overflow-hidden p-0 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-start sm:gap-4 sm:p-4"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-bg-soft sm:h-32 sm:w-40 sm:rounded-2xl">
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

                  <span className="absolute left-3 top-3 z-10 inline-flex rounded-full border border-white/70 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ink shadow-sm backdrop-blur">
                    {duration}
                  </span>

                  {comingSoon && <ComingSoonOverlay compact />}
                </div>

                <div className="min-w-0 px-4 pt-4 sm:px-0 sm:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 text-lg font-bold leading-tight text-ink sm:text-xl">
                      {service.name}
                    </h3>

                    {comingSoon && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                        Coming Soon
                      </span>
                    )}
                  </div>

                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-xs ${
                      isSelfDropOffService(service)
                        ? "bg-violet-50 text-violet-800"
                        : "bg-sky-50 text-sky-700"
                    }`}
                  >
                    {isSelfDropOffService(service) ? <FiMapPin /> : <FiTruck />}
                    {getServiceFulfillmentLabel(service)}
                  </span>

                  {includedItems.length > 0 ? (
                    <>
                      <ul className="mt-3 grid gap-1.5 text-sm sm:hidden">
                        {primaryItems.map((item, index) => (
                          <li
                            key={`${item}-${index}`}
                            className="flex min-w-0 items-start gap-2 leading-5 text-slate-700"
                          >
                            <FiCheck className="mt-0.5 shrink-0 text-brand-dark" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>

                      {extraItems.length > 0 && (
                        <details className="mt-2 rounded-xl bg-bg-soft px-3 py-2 text-xs sm:hidden">
                          <summary className="cursor-pointer font-bold text-muted">
                            +{extraItems.length} more included
                          </summary>
                          <ul className="mt-2 grid gap-1.5">
                            {extraItems.map((item, index) => (
                              <li
                                key={`${item}-extra-${index}`}
                                className="flex items-start gap-2 leading-5 text-slate-700"
                              >
                                <FiCheck className="mt-0.5 shrink-0 text-brand-dark" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}

                      <ul className="mt-3 hidden gap-1.5 text-sm sm:grid">
                        {includedItems.map((item, index) => (
                          <li
                            key={`${item}-desktop-${index}`}
                            className="flex items-start gap-2 leading-5 text-slate-700"
                          >
                            <FiCheck className="mt-0.5 shrink-0 text-brand-dark" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="mt-2 text-sm leading-5 text-muted">
                      Service details are available during checkout.
                    </p>
                  )}
                </div>

                <div className="mx-4 mt-4 flex items-end justify-between gap-3 border-t border-line pb-4 pt-3 text-left sm:m-0 sm:w-44 sm:flex-col sm:items-end sm:border-0 sm:p-0 sm:text-right">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted sm:text-xs sm:normal-case sm:tracking-normal">
                      Estimated
                    </div>
                    {comingSoon ? (
                      <div className="whitespace-nowrap text-lg font-extrabold leading-tight text-ink sm:text-xl">
                        Coming Soon
                      </div>
                    ) : hasPrice ? (
                      <ServicePriceDisplay
                        service={service}
                        className="justify-start sm:justify-end"
                        regularClassName="whitespace-nowrap text-xs font-bold text-red-500 line-through decoration-2 decoration-red-400/90 sm:text-sm"
                        currentClassName="whitespace-nowrap text-xl font-black leading-tight tracking-tight text-ink sm:text-2xl"
                      />
                    ) : (
                      <div className="max-w-44 text-xs font-bold leading-4 text-amber-700 sm:text-sm sm:leading-5">
                        {service.priceUnavailableMessage ||
                          "Price not allocated for this vehicle"}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    aria-pressed={inCart}
                    onClick={() => {
                      if (inCart) {
                        removeFromCart(service.id);
                        return;
                      }

                      if (!comingSoon) {
                        const result = addToCart({
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

                        if (result?.conflict) {
                          setError(result.message);
                          setMobileCartOpen(true);
                        } else {
                          setError("");
                        }
                      }
                    }}
                    disabled={(!hasPrice && !inCart) || (comingSoon && !inCart)}
                    className={`inline-flex h-11 min-w-[6.75rem] shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
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
                      "Unavailable"
                    ) : (
                      <>
                        <FiPlus />
                        Add
                      </>
                    )}
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
                : hasMixedFulfillmentInCart
                  ? "Separate Service Types"
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

              {(hasComingSoonInCart ||
                hasUnavailableInCart ||
                hasMixedFulfillmentInCart) && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  <FiAlertCircle className="mt-0.5 shrink-0" />
                  <span>
                    {hasMixedFulfillmentInCart
                      ? MIXED_FULFILLMENT_MESSAGE
                      : "Remove unavailable or coming-soon services before continuing."}
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
    </div>
  );
}
