import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import LocationPicker from "@/components/maps/LocationPicker";
import BookingPaymentLoader from "@/components/payment/BookingPaymentLoader";
import ServicePriceDisplay from "@/components/services/ServicePriceDisplay";
import {
  buildFullAddress,
  getDefaultUserLocation,
  getLocationAddress,
  getProfileAddress,
  hasUsableIndiaCoordinates,
  parseAddressParts,
} from "@/utils/address";
import {
  formatRupeeRange,
  formatRupees,
  getServiceMinPrice,
  getServiceMaxPrice,
} from "@/utils/priceRange";
import { calculatePlatformFee } from "@/utils/platformFee";
import {
  BOOKING_PAYMENT_PROGRESS,
  getPaymentErrorCode,
  payForBooking,
  preloadCashfreeCheckout,
} from "@/utils/bookingPayment";
import { requireAvailableCityName } from "@/utils/cityAvailability";
import { addRecentActivity } from "@/utils/activityLog";
import {
  SERVICE_FULFILLMENT_TYPE,
  cartRequiresSelfDropOff,
} from "@/utils/serviceFulfillment";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiCreditCard,
  FiMapPin,
  FiPhone,
  FiTrash2,
  FiTruck,
  FiEdit,
  FiSave,
  FiX,
} from "react-icons/fi";

const hasCompleteServiceLocation = (candidate) =>
  hasUsableIndiaCoordinates(candidate) && Boolean(getLocationAddress(candidate));

const normalizeSavedLocation = (candidate = {}) => {
  const fullAddress = getLocationAddress(candidate);

  return {
    ...candidate,
    latitude: Number(candidate.latitude ?? candidate.lat),
    longitude: Number(candidate.longitude ?? candidate.lng),
    address: fullAddress,
    formattedAddress: fullAddress,
    fullAddress,
  };
};

const getPreferredSavedLocation = (locations = []) => {
  const validLocations = locations.filter(hasCompleteServiceLocation);

  return (
    validLocations.find((item) => item.isDefault) || validLocations[0] || null
  );
};

const getCheckoutAddressForm = ({ location, user }) => {
  const defaultUserLocation = getDefaultUserLocation(user);
  const source = hasCompleteServiceLocation(location)
    ? location
    : defaultUserLocation || location || {};
  const fullAddress =
    getLocationAddress(source) || getProfileAddress(user) || "";

  const parts = parseAddressParts(fullAddress);

  return {
    ...source,
    ...parts,
    address: source.address || parts.address,
    city: source.city || parts.city || "",
    formattedAddress: fullAddress,
    fullAddress,
  };
};

const toBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true";

const isCartItemComingSoon = (item) =>
  toBoolean(item?.isComingSoon) ||
  toBoolean(item?.categoryComingSoon) ||
  toBoolean(item?.category?.isComingSoon);

const INDIA_PHONE_REGEX = /^\+91[6-9]\d{9}$/;
const ACTIVE_VEHICLE_BOOKING_STATUSES = [
  "PENDING_PAYMENT",
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
];

const getVehicleLabel = (vehicle) =>
  `${vehicle?.brand || ""} ${vehicle?.model || ""}`.trim() ||
  vehicle?.registrationNumber ||
  "this vehicle";

const getActiveBookingPath = (booking) =>
  booking?.status === "PENDING_PAYMENT"
    ? "/dashboard/pending-bookings"
    : "/dashboard/bookings";

const getActiveVehicleBookingMessage = (booking, vehicle) => {
  const bookingLabel = booking?.bookingCode || booking?.id || "active booking";

  return `${getVehicleLabel(vehicle)} already has an active booking (${bookingLabel}). Complete or cancel it before booking this vehicle again.`;
};

const normalizeIndianPhone = (value = "") => {
  let digits = String(value).replace(/\D/g, "");

  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  digits = digits.slice(0, 10);
  return digits ? `+91${digits}` : "";
};

export default function Checkout() {
  const {
    cart,
    vehicle,
    location,
    setLocation,
    user,
    setUser,
    clearCart,
    clearBookingCaches,
    clearProfileCache,
    fetchProfile,
  } = useApp();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState(user?.phone || "");
  const [pendingBooking, setPendingBooking] = useState(null);
  const [activeVehicleBooking, setActiveVehicleBooking] = useState(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [useWallet, setUseWallet] = useState(false);
  const [paymentProgress, setPaymentProgress] = useState(null);
  const [fulfillmentType, setFulfillmentType] = useState(
    SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY,
  );
  const paymentAttemptRef = useRef(false);
  const [addressForm, setAddressForm] = useState(() =>
    getCheckoutAddressForm({ location, user }),
  );

  const loadWallet = async () => {
    try {
      const response = await api.get("/wallet");
      setWallet(response.data?.data || null);
    } catch {
      setWallet(null);
    }
  };

  const subTotalMin = cart.reduce(
    (sum, item) => sum + getServiceMinPrice(item),
    0,
  );
  const subTotalMax = cart.reduce(
    (sum, item) => sum + getServiceMaxPrice(item),
    0,
  );
  const payAtGarageMin = subTotalMin;
  const payAtGarageMax = subTotalMax;
  const payNowAmount = calculatePlatformFee(payAtGarageMax);
  const walletBalance = Number(wallet?.balance || 0);
  const walletAmountUsed = useWallet
    ? Math.min(walletBalance, payNowAmount)
    : 0;
  const cashfreePayNowAmount = Math.max(payNowAmount - walletAmountUsed, 0);
  const paymentMethod =
    useWallet && walletAmountUsed > 0
      ? cashfreePayNowAmount <= 0
        ? "wallet"
        : "split"
      : "cashfree";
  const walletOnlyExpected = paymentMethod === "wallet";
  const savedPhone = normalizeIndianPhone(user?.phone || "");
  const phoneToSave = normalizeIndianPhone(phoneDraft);
  const hasSavedPhone = INDIA_PHONE_REGEX.test(savedPhone);
  const canSavePhone = INDIA_PHONE_REGEX.test(phoneToSave);
  const comingSoonItems = cart.filter(isCartItemComingSoon);
  const hasComingSoonItems = comingSoonItems.length > 0;
  const requiresSelfDropOff = cartRequiresSelfDropOff(cart);
  const isSelfDropOffBooking =
    fulfillmentType === SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF;
  const blocksCurrentVehicleBooking =
    Boolean(activeVehicleBooking?.id) &&
    activeVehicleBooking.id !== pendingBooking?.id;
  const activeVehicleBookingPath = getActiveBookingPath(activeVehicleBooking);

  useEffect(() => {
    setPhoneDraft(user?.phone || "");
  }, [user?.phone]);

  useEffect(() => {
    preloadCashfreeCheckout();
  }, []);

  useEffect(() => {
    void loadWallet();
  }, []);

  useEffect(() => {
    if (useWallet && walletBalance <= 0) {
      setUseWallet(false);
    }
  }, [useWallet, walletBalance]);

  useEffect(() => {
    if (requiresSelfDropOff) {
      setFulfillmentType(SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF);
    }
  }, [requiresSelfDropOff]);

  useEffect(() => {
    let mounted = true;

    if (!vehicle?.id || pendingBooking?.id) {
      setActiveVehicleBooking(null);

      return () => {
        mounted = false;
      };
    }

    api
      .get("/bookings", {
        params: {
          status: ACTIVE_VEHICLE_BOOKING_STATUSES.join(","),
        },
      })
      .then((response) => {
        if (!mounted) return;

        const bookings = response.data?.data || [];
        const matchingBooking = bookings.find(
          (booking) =>
            booking.vehicleId === vehicle.id ||
            booking.vehicle?.id === vehicle.id,
        );

        setActiveVehicleBooking(matchingBooking || null);
      })
      .catch(() => {
        if (mounted) setActiveVehicleBooking(null);
      });

    return () => {
      mounted = false;
    };
  }, [vehicle?.id, pendingBooking?.id]);

  useEffect(() => {
    if (!editingAddress) {
      setAddressForm(getCheckoutAddressForm({ location, user }));
    }
  }, [editingAddress, location, user]);

  useEffect(() => {
    if (!user?.id || hasCompleteServiceLocation(location)) {
      return undefined;
    }

    const defaultUserLocation = getDefaultUserLocation(user);

    if (defaultUserLocation) {
      setLocation(normalizeSavedLocation(defaultUserLocation));
      return undefined;
    }

    let cancelled = false;

    api
      .get("/locations")
      .then((response) => {
        if (cancelled) return;

        const savedLocations = Array.isArray(response.data?.data)
          ? response.data.data
          : [];
        const savedLocation = getPreferredSavedLocation(savedLocations);

        if (!savedLocation) return;

        const normalizedLocation = normalizeSavedLocation(savedLocation);
        const nextUser = {
          ...(user || {}),
          locations: savedLocations,
        };

        setLocation(normalizedLocation);
        setAddressForm(
          getCheckoutAddressForm({
            location: normalizedLocation,
            user: nextUser,
          }),
        );
        setUser?.((previous) => ({
          ...(previous || {}),
          locations: savedLocations,
        }));
      })
      .catch(() => {
        // Checkout retries this lookup before payment. Do not interrupt the page
        // while a saved-location hydration request is temporarily unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const savePhoneNumber = async () => {
    if (!canSavePhone) {
      setError("Enter a valid 10-digit Indian mobile number before payment.");
      return false;
    }

    try {
      setSavingPhone(true);
      setError("");

      const response = await api.patch("/customer/profile", {
        phone: phoneToSave,
      });
      const responseData = response.data?.data;
      const responseUser = responseData?.user || responseData || {};
      const nextUser = {
        ...(user || {}),
        ...responseUser,
        phone: responseUser.phone || phoneToSave,
      };

      setUser?.(nextUser);
      clearProfileCache?.();
      await fetchProfile?.({ force: true });
      return true;
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not save phone number. Please try again.",
      );
      return false;
    } finally {
      setSavingPhone(false);
    }
  };

  const buildLocationPayload = async () => {
    const toPayload = async (candidate) => {
      if (!hasCompleteServiceLocation(candidate)) return null;

      const normalizedLocation = normalizeSavedLocation(candidate);
      const city = await requireAvailableCityName(normalizedLocation);

      return {
        latitude: normalizedLocation.latitude,
        longitude: normalizedLocation.longitude,
        address: normalizedLocation.fullAddress,
        city,
        placeId: normalizedLocation.placeId || null,
      };
    };

    // A booking must use the service address the customer explicitly selected.
    // Never replace it with the browser's current position: the customer and
    // vehicle may be elsewhere while the garage still needs to reach this pin.
    const selectedLocationPayload = await toPayload(location);
    if (selectedLocationPayload) return selectedLocationPayload;

    const defaultUserLocation = getDefaultUserLocation(user);
    const defaultLocationPayload = await toPayload(defaultUserLocation);

    if (defaultLocationPayload) {
      const normalizedLocation = normalizeSavedLocation(defaultUserLocation);
      setLocation(normalizedLocation);
      setAddressForm(
        getCheckoutAddressForm({ location: normalizedLocation, user }),
      );
      return defaultLocationPayload;
    }

    let savedLocations = [];

    try {
      const response = await api.get("/locations");
      savedLocations = Array.isArray(response.data?.data)
        ? response.data.data
        : [];
    } catch {
      return null;
    }

    const savedLocation = getPreferredSavedLocation(savedLocations);
    const savedLocationPayload = await toPayload(savedLocation);

    if (!savedLocationPayload) return null;

    const normalizedLocation = normalizeSavedLocation(savedLocation);
    const nextUser = {
      ...(user || {}),
      locations: savedLocations,
    };

    setLocation(normalizedLocation);
    setAddressForm(
      getCheckoutAddressForm({
        location: normalizedLocation,
        user: nextUser,
      }),
    );
    setUser?.((previous) => ({
      ...(previous || {}),
      locations: savedLocations,
    }));

    return savedLocationPayload;
  };

  const saveAddress = async () => {
    let city = "";

    try {
      city = await requireAvailableCityName(addressForm);
    } catch (err) {
      setError(err.message);
      return;
    }

    if (!hasUsableIndiaCoordinates(addressForm)) {
      setError("Search and confirm the exact address on the map.");
      return;
    }

    const canonicalAddressForm = { ...addressForm, city };
    const fullAddress =
      canonicalAddressForm.formattedAddress ||
      canonicalAddressForm.fullAddress ||
      buildFullAddress(canonicalAddressForm);
    const nextLocation = {
      ...canonicalAddressForm,
      city,
      fullAddress,
      formattedAddress: fullAddress,
      address: fullAddress,
      latitude: Number(addressForm.latitude ?? addressForm.lat),
      longitude: Number(addressForm.longitude ?? addressForm.lng),
    };
    const locationPayload = {
      latitude: nextLocation.latitude,
      longitude: nextLocation.longitude,
      address: fullAddress,
      formattedAddress: fullAddress,
      city,
      placeId: nextLocation.placeId || null,
      addressComponents: nextLocation.addressComponents || undefined,
      source: nextLocation.source === "GPS" ? "GPS" : "MANUAL",
      isDefault: true,
    };

    try {
      setSavingAddress(true);
      setError("");

      const response = nextLocation.id
        ? await api.patch(`/locations/${nextLocation.id}`, locationPayload)
        : await api.post("/locations", locationPayload);
      const persistedLocation = normalizeSavedLocation({
        ...nextLocation,
        ...(response.data?.data || {}),
        city,
        isDefault: true,
      });

      setLocation(persistedLocation);
      setAddressForm(
        getCheckoutAddressForm({ location: persistedLocation, user }),
      );
      clearProfileCache?.();
      await fetchProfile?.({ force: true });
      addRecentActivity({
        type: "LOCATION",
        title: "Changed service location",
        detail: `${city}${canonicalAddressForm.area ? `, ${canonicalAddressForm.area}` : ""}`,
        path: "/checkout",
      });

      setEditingAddress(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not save this address. Please try again.",
      );
    } finally {
      setSavingAddress(false);
    }
  };

  const performBookingPayment = async () => {
    if (!vehicle?.id) {
      setError("Please select a vehicle before checkout.");
      nav("/booking/vehicle");
      return;
    }

    if (blocksCurrentVehicleBooking) {
      setError(
        getActiveVehicleBookingMessage(activeVehicleBooking, vehicle),
      );
      return;
    }

    if (cart.length === 0) {
      setError("Please add at least one service before checkout.");
      nav("/booking/services");
      return;
    }

    if (hasComingSoonItems) {
      setError(
        `${comingSoonItems.map((item) => item.name).join(", ")} ${
          comingSoonItems.length === 1 ? "is" : "are"
        } coming soon. Remove ${
          comingSoonItems.length === 1 ? "it" : "them"
        } before checkout.`,
      );
      return;
    }

    if (!hasSavedPhone) {
      setError("Save a valid mobile number before opening payment.");
      return;
    }

    let checkoutLocation = null;

    try {
      checkoutLocation = await buildLocationPayload();
    } catch (err) {
      setError(err.message);
      setEditingAddress(true);
      return;
    }

    if (!checkoutLocation) {
      setError("Please save a valid service location before checkout.");
      setEditingAddress(true);
      return;
    }

    try {
      setLoading(true);
      setError("");

      let booking = pendingBooking;

      if (!booking?.id) {
        setPaymentProgress(BOOKING_PAYMENT_PROGRESS.CREATING_BOOKING);
        const bookingRes = await api.post("/bookings/checkout", {
          vehicleId: vehicle.id,
          serviceIds: cart.map((item) => item.id),
          fulfillmentType,
          location: checkoutLocation,
        });

        booking = bookingRes.data.data;
        setPendingBooking(booking);
      }

      const paidBooking = await payForBooking({
        booking,
        useWallet,
        walletOnlyExpected,
        onProgress: setPaymentProgress,
      });

      clearCart();
      clearBookingCaches?.();
      setPendingBooking(null);
      nav("/tracking", {
        state: {
          bookingId: paidBooking?.id || booking.id,
          bookingCode: paidBooking?.bookingCode || booking.bookingCode,
        },
      });
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Could not complete booking payment. Please try again.";

      setError(
        getPaymentErrorCode(err) === "PAYMENT_REFUNDED_TO_WALLET"
          ? `${message} Your wallet balance has been refreshed.`
          : message,
      );
      await loadWallet();
    } finally {
      setPaymentProgress(null);
      setLoading(false);
    }
  };

  const bookService = async () => {
    if (paymentAttemptRef.current) return;

    paymentAttemptRef.current = true;
    try {
      await performBookingPayment();
    } finally {
      paymentAttemptRef.current = false;
    }
  };

  return (
    <>
      <BookingPaymentLoader
        phase={paymentProgress}
        paymentMethod={paymentMethod}
      />
      <div className="container-x grid gap-8 py-12 lg:grid-cols-[1fr_400px]">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">Checkout</h1>
        <p className="mt-1 text-muted">
          {isSelfDropOffBooking
            ? "Pay the platform fee now to start nearby garage search. Your saved location is used only to find a suitable garage; you must take the vehicle to the assigned garage and collect it after service."
            : "Pay the platform fee now to start garage search. The garage will use your saved service address below, regardless of your current device location. Edit it only when you want the garage to arrive somewhere else. The final service amount is paid directly to the garage after the work is complete."}
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {blocksCurrentVehicleBooking && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <FiAlertCircle
                className="mt-0.5 shrink-0 text-lg text-amber-700"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">
                  This vehicle already has an active booking.
                </p>
                <p className="mt-1 leading-6 text-amber-800">
                  Complete or cancel{" "}
                  {activeVehicleBooking.bookingCode ||
                    activeVehicleBooking.id ||
                    "that booking"}{" "}
                  before booking {getVehicleLabel(vehicle)} again. You can
                  still book another saved vehicle.
                </p>
                <button
                  type="button"
                  onClick={() => nav(activeVehicleBookingPath)}
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-ink px-3 text-xs font-bold text-white transition hover:bg-ink-2"
                >
                  View active booking
                </button>
              </div>
            </div>
          </div>
        )}

        {hasComingSoonItems && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">Coming soon:</span>{" "}
            {comingSoonItems.map((item) => item.name).join(", ")}. Remove
            {comingSoonItems.length === 1 ? " this service" : " these services"}{" "}
            before booking.
          </div>
        )}

        <section className="card-soft mt-6 p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-ink">Choose vehicle handover</h2>
            <p className="text-sm leading-6 text-muted">
              Select how the vehicle reaches the garage for this booking. Garage alerts are sent only to garages that support your selected option and vehicle brand.
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                value: SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY,
                title: "Pickup & delivery",
                description: "An eligible garage collects the vehicle from your saved service address and returns it after service.",
                icon: FiTruck,
                disabled: requiresSelfDropOff,
              },
              {
                value: SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF,
                title: "Self drop-off & pickup",
                description: "You take the vehicle to the assigned garage and collect it after the service is ready.",
                icon: FiMapPin,
                disabled: false,
              },
            ].map((option) => {
              const selected = fulfillmentType === option.value;
              const Icon = option.icon;

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled || Boolean(pendingBooking?.id)}
                  onClick={() => {
                    setFulfillmentType(option.value);
                    setError("");
                  }}
                  className={`flex min-h-32 items-start gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-ink bg-white shadow-sm ring-1 ring-ink"
                      : "border-line bg-bg-soft/60 hover:border-ink/30 hover:bg-white"
                  }`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${selected ? "bg-brand text-black" : "bg-white text-muted"}`}>
                    <Icon />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-bold text-ink">
                      {option.title}
                      {selected && <FiCheckCircle className="text-green-700" />}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-muted">
                      {option.description}
                    </span>
                    {option.disabled && (
                      <span className="mt-2 block text-xs font-semibold text-violet-700">
                        A selected service is self drop-off only.
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {!hasSavedPhone && (
          <div className="card-soft mt-5 grid gap-4 border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700">
                <FiPhone />
              </span>
              <div>
                <h3 className="font-semibold text-amber-900">
                  Mobile number required
                </h3>
                <p className="mt-1 text-sm text-amber-800">
                  Save your phone number first. Cashfree needs it to open the
                  payment window.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={phoneDraft}
                onChange={(event) => {
                  setPhoneDraft(event.target.value.replace(/[^\d+]/g, ""));
                  setError("");
                }}
                inputMode="tel"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                className="h-11 rounded-xl border border-amber-200 bg-white px-4 text-sm outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={savePhoneNumber}
                disabled={savingPhone || !canSavePhone}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white shadow-sm transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiCheckCircle />
                {savingPhone ? "Saving..." : "Save phone"}
              </button>
            </div>
          </div>
        )}

        <div className="card-soft mt-8 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {isSelfDropOffBooking
                ? "Location for nearby garage matching"
                : "Service Address"}
            </h3>
            {!editingAddress && (
              <button
                type="button"
                onClick={() => setEditingAddress(true)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft"
              >
                <FiEdit /> Edit
              </button>
            )}
          </div>

          {editingAddress ? (
            <div className="grid gap-4">
              <LocationPicker
                value={addressForm}
                onChange={(next) => {
                  setAddressForm(next);
                  setError("");
                }}
                label={
                  isSelfDropOffBooking
                    ? "Search your location"
                    : "Search service address"
                }
                helper={
                  isSelfDropOffBooking
                    ? "This location is used to find nearby garages. The garage will not collect or return the vehicle."
                    : "Select the address and confirm the exact service entrance."
                }
                required
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAddress(false)}
                  disabled={savingAddress}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiX /> Cancel
                </button>
                <button
                  type="button"
                  onClick={saveAddress}
                  disabled={savingAddress}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiSave /> {savingAddress ? "Saving..." : "Save address"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-muted">
              {addressForm.formattedAddress || addressForm.fullAddress || buildFullAddress(addressForm) || "No address set"}
            </div>
          )}


          {isSelfDropOffBooking && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
              <FiMapPin className="mt-1 shrink-0" />
              <p>
                <span className="font-bold">Self drop-off booking:</span> no pickup or return vehicle is included. After a garage accepts, you will receive its address, map and handover OTP.
              </p>
            </div>
          )}
        </div>

        <div className="card-soft mt-6 p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Benefits with this booking
          </h3>
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              "Booking Confirmation",
              "Priority Slot",
              "30-Day Warranty",
              "24x7 Customer Support",
            ].map((benefit) => (
              <li key={benefit} className="flex items-center gap-2">
                <FiCheckCircle className="text-brand-dark" /> {benefit}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <aside className="card-soft h-fit p-5 sm:p-6 lg:sticky lg:top-24">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand">
            {isSelfDropOffBooking ? <FiMapPin /> : <FiTruck />}
          </span>
          <div className="text-sm">
            <div className="font-semibold">
              {vehicle?.brand || "Hyundai"} {vehicle?.model || "i20"}
            </div>
            <div className="text-xs text-muted">
              {vehicle?.fuelType || vehicle?.fuel || "Petrol"}
            </div>
            <div className="mt-1 text-xs font-semibold text-ink">
              {isSelfDropOffBooking
                ? "Self drop-off & pickup"
                : "Pickup & delivery"}
            </div>
          </div>
        </div>

        <hr className="my-4 border-line" />

        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="font-semibold">Order Summary</div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-muted shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <FiTrash2 /> Clear
            </button>
          )}
        </div>
        <div className="grid gap-2 text-sm">
          {cart.length === 0 ? (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-muted">
              <span className="min-w-0 truncate">No services selected</span>
              <span className="whitespace-nowrap text-right">
                {formatRupees(0)}
              </span>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"
              >
                <span className="min-w-0 truncate">{item.name}</span>
                <ServicePriceDisplay
                  service={item}
                  className="max-w-56 justify-end text-right"
                  regularClassName="text-xs font-semibold text-red-500 line-through decoration-[1.5px] decoration-red-500"
                  currentClassName="text-sm font-black text-ink"
                />
              </div>
            ))
          )}
        </div>

        <hr className="my-4 border-line" />

        <div className="grid gap-2 text-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <span className="text-muted">Cash at service</span>
            <span className="whitespace-nowrap text-right font-semibold">
              {formatRupeeRange(payAtGarageMin, payAtGarageMax)}
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <span className="text-muted">Platform fee</span>
            <span className="whitespace-nowrap text-right font-semibold">
              {formatRupees(payNowAmount)}
            </span>
          </div>
        </div>

        <label
          className={`mt-4 flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
            walletBalance > 0
              ? "border-brand/40 bg-brand/10 hover:bg-brand/15"
              : "border-line bg-bg-soft text-muted"
          }`}
        >
          <input
            type="checkbox"
            checked={useWallet}
            disabled={walletBalance <= 0 || payNowAmount <= 0}
            onChange={(event) => setUseWallet(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-line accent-black disabled:cursor-not-allowed"
          />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">
              Use wallet balance
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Available: {formatRupees(walletBalance)}
              {useWallet && walletAmountUsed > 0
                ? ` • Applying ${formatRupees(walletAmountUsed)}`
                : ""}
            </span>
          </span>
        </label>

        <div className="mt-4 rounded-xl border border-line bg-white p-3 text-sm">
          {useWallet && walletAmountUsed > 0 && (
            <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-muted">
              <span>Wallet applied</span>
              <span className="whitespace-nowrap text-right font-semibold text-green-700">
                -{formatRupees(walletAmountUsed)}
              </span>
            </div>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-base">
            <span className="font-semibold">Amount to pay now</span>
            <span className="whitespace-nowrap text-right text-xl font-bold">
              {formatRupees(cashfreePayNowAmount)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={bookService}
          disabled={
            loading ||
            cart.length === 0 ||
            hasComingSoonItems ||
            blocksCurrentVehicleBooking ||
            !hasSavedPhone
          }
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FiCreditCard />{" "}
          {loading
            ? cashfreePayNowAmount > 0
              ? "Opening payment..."
              : "Activating booking..."
            : hasComingSoonItems
              ? "Remove Coming Soon Services"
              : cart.length === 0
                ? "Add services to continue"
                : blocksCurrentVehicleBooking
                  ? "Complete active booking first"
                  : !hasSavedPhone
                    ? "Save phone to pay"
                    : cashfreePayNowAmount > 0
                      ? `Pay ${formatRupees(cashfreePayNowAmount)} Now`
                      : "Pay with wallet"}
        </button>
        <div className="mt-3 text-center text-xs text-muted">
          {isSelfDropOffBooking
            ? "Pay only the platform fee now. Take the vehicle to the assigned garage and pay the final service amount there."
            : "Pay only the platform fee now. The service amount is paid in cash at the garage after work is complete."}
        </div>
      </aside>
      </div>
    </>
  );
}
