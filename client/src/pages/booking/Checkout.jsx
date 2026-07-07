import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import LocationPicker from "@/components/maps/LocationPicker";
import {
  buildFullAddress,
  getDefaultUserLocation,
  getProfileAddress,
  hasUsableIndiaCoordinates,
  parseAddressParts,
} from "@/utils/address";
import {
  formatServicePriceRange,
  getServiceMinPrice,
  getServiceMaxPrice,
} from "@/utils/priceRange";
import { requireAvailableCityName } from "@/utils/cityAvailability";
import { addRecentActivity } from "@/utils/activityLog";
import {
  FiCheckCircle,
  FiTrash2,
  FiTruck,
  FiEdit,
  FiSave,
  FiX,
} from "react-icons/fi";

const getCheckoutAddressForm = ({ location, user }) => {
  const defaultUserLocation = getDefaultUserLocation(user);
  const source = location || defaultUserLocation || {};
  const fullAddress =
    source.formattedAddress ||
    source.fullAddress ||
    source.address ||
    getProfileAddress(user) ||
    "";

  const parts = parseAddressParts(fullAddress);

  return {
    ...source,
    ...parts,
    address: source.address || parts.address,
    city: parts.city || source.city || "",
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

export default function Checkout() {
  const {
    cart,
    vehicle,
    location,
    setLocation,
    user,
    clearCart,
    clearBookingCaches,
    clearProfileCache,
    fetchProfile,
  } = useApp();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState(() =>
    getCheckoutAddressForm({ location, user }),
  );

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
  const comingSoonItems = cart.filter(isCartItemComingSoon);
  const hasComingSoonItems = comingSoonItems.length > 0;

  useEffect(() => {
    if (!editingAddress) {
      setAddressForm(getCheckoutAddressForm({ location, user }));
    }
  }, [editingAddress, location, user]);

  const buildLocationPayload = async () => {
    const defaultUserLocation = getDefaultUserLocation(user);
    const currentAddress =
      location?.fullAddress || buildFullAddress(location) || location?.address;

    if (hasUsableIndiaCoordinates(location) && currentAddress) {
      const city = await requireAvailableCityName(location);

      return {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        address: currentAddress,
        city,
        placeId: location.placeId || null,
      };
    }

    if (
      defaultUserLocation?.address &&
      hasUsableIndiaCoordinates(defaultUserLocation)
    ) {
      const city = await requireAvailableCityName(defaultUserLocation);

      return {
        latitude: Number(defaultUserLocation.latitude),
        longitude: Number(defaultUserLocation.longitude),
        address: defaultUserLocation.formattedAddress || defaultUserLocation.address,
        city,
        placeId: defaultUserLocation.placeId || null,
      };
    }

    return null;
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
      latitude: Number(addressForm.latitude),
      longitude: Number(addressForm.longitude),
    };

    setLocation(nextLocation);

    try {
      await api.post("/locations", {
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
        address: fullAddress,
        formattedAddress: fullAddress,
        city,
        placeId: nextLocation.placeId || null,
        addressComponents: nextLocation.addressComponents || undefined,
        source: nextLocation.source === "GPS" ? "GPS" : "MANUAL",
        isDefault: true,
      });
      clearProfileCache?.();
      await fetchProfile?.({ force: true });
      addRecentActivity({
        type: "LOCATION",
        title: "Changed service location",
        detail: `${city}${canonicalAddressForm.area ? `, ${canonicalAddressForm.area}` : ""}`,
        path: "/checkout",
      });
    } catch (err) {
      console.error("Failed to save address to profile:", err);
    }

    setEditingAddress(false);
    setError("");
  };

  const bookService = async () => {
    if (!vehicle?.id) {
      setError("Please select a vehicle before checkout.");
      nav("/booking/vehicle");
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

      const bookingRes = await api.post("/bookings/checkout", {
        vehicleId: vehicle.id,
        serviceIds: cart.map((item) => item.id),
        location: checkoutLocation,
      });

      const booking = bookingRes.data.data;
      addRecentActivity({
        type: "BOOKING",
        title: "Created booking",
        detail: booking.bookingCode || cart.map((item) => item.name).join(", "),
        path: "/dashboard/bookings",
      });

      clearCart();
      clearBookingCaches?.();
      nav("/tracking", {
        state: { bookingId: booking.id, bookingCode: booking.bookingCode },
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not create booking. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-x grid gap-8 py-12 lg:grid-cols-[1fr_400px]">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">Checkout</h1>
        <p className="mt-1 text-muted">
          Confirm the request now. Pay the final service amount directly to the
          garage in cash after the work is complete.
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
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

        <div className="card-soft mt-8 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Delivery Address</h3>
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
                label="Search delivery address"
                helper="Select the address and confirm the exact service entrance."
                showCurrentLocation
                required
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAddress(false)}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft"
                >
                  <FiX /> Cancel
                </button>
                <button
                  type="button"
                  onClick={saveAddress}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark"
                >
                  <FiSave /> Save address
                </button>
              </div>
            </div>
          ) : (
            <div className="text-muted">
              {addressForm.formattedAddress || addressForm.fullAddress || buildFullAddress(addressForm) || "No address set"}
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
            <FiTruck />
          </span>
          <div className="text-sm">
            <div className="font-semibold">
              {vehicle?.brand || "Hyundai"} {vehicle?.model || "i20"}
            </div>
            <div className="text-xs text-muted">
              {vehicle?.fuelType || vehicle?.fuel || "Petrol"}
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
              <span className="whitespace-nowrap text-right">â‚¹0</span>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"
              >
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="whitespace-nowrap text-right font-semibold">
                  {formatServicePriceRange(item)}
                </span>
              </div>
            ))
          )}
        </div>

        <hr className="my-4 border-line" />

        <div className="grid gap-2 text-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <span className="text-muted">Service estimate</span>
            <span className="whitespace-nowrap text-right font-semibold">
              â‚¹{payAtGarageMin} - â‚¹{payAtGarageMax}
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-base">
            <span className="font-semibold">Cash at garage</span>
            <span className="whitespace-nowrap text-right text-xl font-bold">
              {payAtGarageMin === payAtGarageMax
                ? `\u20b9${payAtGarageMax}`
                : `\u20b9${payAtGarageMin} - \u20b9${payAtGarageMax}`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={bookService}
          disabled={loading || hasComingSoonItems}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FiCheckCircle />{" "}
          {loading
            ? "Booking..."
            : hasComingSoonItems
              ? "Remove Coming Soon Services"
              : "Confirm Booking"}
        </button>
        <div className="mt-3 text-center text-xs text-muted">
          The garage records the final amount before delivery.
        </div>
      </aside>
    </div>
  );
}
