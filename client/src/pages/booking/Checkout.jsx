import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import CitySelect from "@/components/common/CitySelect";
import { isPaymentAuthError, payForBooking } from "@/utils/bookingPayment";
import { queueGeocodeRequest } from "@/utils/geocodeService";
import {
  buildFullAddress,
  getDefaultUserLocation,
  getProfileAddress,
  parseAddressParts,
} from "@/utils/address";
import { formatServicePriceRange, getServiceMinPrice, getServiceMaxPrice } from "@/utils/priceRange";
import { isCityAvailable, UNAVAILABLE_CITY_MESSAGE } from "@/utils/cityAvailability";
import { addRecentActivity } from "@/utils/activityLog";
import { FiCheckCircle, FiLock, FiTrash2, FiTruck, FiEdit } from "react-icons/fi";

const DEFAULT_LOCATION = {
  latitude: 28.6369,
  longitude: 77.3696,
  address: "Indirapuram, Ghaziabad, 201014",
};

const getCheckoutAddressForm = ({ location, user }) => {
  const defaultUserLocation = getDefaultUserLocation(user);
  const fullAddress =
    location?.fullAddress ||
    buildFullAddress(location) ||
    defaultUserLocation?.address ||
    getProfileAddress(user) ||
    "";

  return parseAddressParts(fullAddress);
};

const calculateHandlingFee = (totalServiceAmount) => {
  if (totalServiceAmount >= 300 && totalServiceAmount < 1000) return 30;
  if (totalServiceAmount >= 1000 && totalServiceAmount < 5000) return 99;
  if (totalServiceAmount >= 5000 && totalServiceAmount < 20000) return 249;
  if (totalServiceAmount >= 20000) return 500;

  return 99;
};

export default function Checkout() {
  const { cart, vehicle, location, setLocation, user, clearCart, clearBookingCaches, clearProfileCache, fetchProfile } =
    useApp();
  const nav = useNavigate();
  const routeLocation = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState(() =>
    getCheckoutAddressForm({ location, user })
  );

  const subTotalMin = cart.reduce((sum, item) => sum + getServiceMinPrice(item), 0);
  const subTotalMax = cart.reduce((sum, item) => sum + getServiceMaxPrice(item), 0);
  const feeBaseAmount = subTotalMax || subTotalMin || 0;
  const fee = cart.length === 0 ? 0 : calculateHandlingFee(feeBaseAmount);
  const payAtGarageMin = subTotalMin;
  const payAtGarageMax = subTotalMax;

  useEffect(() => {
    if (!editingAddress) {
      setAddressForm(getCheckoutAddressForm({ location, user }));
    }
  }, [editingAddress, location, user]);

  const buildLocationPayload = () => {
    const defaultUserLocation = getDefaultUserLocation(user);
    const fullAddress =
      buildFullAddress(addressForm) ||
      location?.fullAddress ||
      defaultUserLocation?.address ||
      getProfileAddress(user) ||
      DEFAULT_LOCATION.address;

    return {
      latitude:
        location?.latitude || defaultUserLocation?.latitude || DEFAULT_LOCATION.latitude,
      longitude:
        location?.longitude || defaultUserLocation?.longitude || DEFAULT_LOCATION.longitude,
      address: fullAddress,
    };
  };

  const handleAddressChange = (e) => {
    setAddressForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const saveAddress = async () => {
    if (!(await isCityAvailable(addressForm.city))) {
      setError(UNAVAILABLE_CITY_MESSAGE);
      return;
    }

    const fullAddress = buildFullAddress(addressForm);
    let latitude = null;
    let longitude = null;

    try {
      const geocode = await queueGeocodeRequest(
        addressForm.address,
        addressForm.city,
        addressForm.area,
        addressForm.pincode
      );
      latitude = geocode.latitude;
      longitude = geocode.longitude;
    } catch (err) {
      setError(err.message || "Could not find coordinates for this address.");
      return;
    }

    const nextLocation = {
      ...addressForm,
      fullAddress,
      latitude,
      longitude,
    };

    setLocation(nextLocation);

    try {
      await api.post("/locations", {
        latitude,
        longitude,
        address: fullAddress,
        source: "MANUAL",
        isDefault: true,
      });
      clearProfileCache?.();
      await fetchProfile?.({ force: true });
      addRecentActivity({
        type: "LOCATION",
        title: "Changed service location",
        detail: `${addressForm.city}${addressForm.area ? `, ${addressForm.area}` : ""}`,
        path: "/checkout",
      });
    } catch (err) {
      console.error("Failed to save address to profile:", err);
    }

    setEditingAddress(false);
  };

  const pay = async () => {
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

    try {
      setLoading(true);
      setError("");

      const bookingRes = await api.post("/bookings/checkout", {
        vehicleId: vehicle.id,
        serviceIds: cart.map((item) => item.id),
        location: buildLocationPayload(),
      });

      const booking = bookingRes.data.data;
      addRecentActivity({
        type: "BOOKING",
        title: "Created booking",
        detail: booking.bookingCode || cart.map((item) => item.name).join(", "),
        path: "/dashboard/bookings",
      });

      if (booking.payableAmount <= 0 || booking.status === "SEARCHING_GARAGE") {
        clearCart();
        clearBookingCaches?.();
        nav("/tracking", {
          state: { bookingId: booking.id, bookingCode: booking.bookingCode },
        });
        return;
      }

      const verifiedBooking = await payForBooking({ booking, user });

      clearCart();
      clearBookingCaches?.();
      nav("/tracking", {
        state: {
          bookingId: verifiedBooking.id,
          bookingCode: verifiedBooking.bookingCode,
        },
      });
    } catch (err) {
      if (isPaymentAuthError(err)) {
        nav("/login", {
          state: {
            from: routeLocation,
            message: "Please login to continue payment.",
          },
        });
        return;
      }

      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not complete payment. Please try again."
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
          Pay a small fee to confirm your booking. Rest pays at garage.
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="card-soft mt-8 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Delivery Address</h3>
            {!editingAddress && (
              <button
                type="button"
                onClick={() => setEditingAddress(true)}
                className="flex items-center gap-1 text-sm font-medium text-ink"
              >
                <FiEdit /> Edit
              </button>
            )}
          </div>

          {editingAddress ? (
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Full Address</span>
                <input
                  required
                  name="address"
                  value={addressForm.address}
                  onChange={handleAddressChange}
                  placeholder="House number, Street, Landmark"
                  className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">Area</span>
                  <input
                    required
                    name="area"
                    value={addressForm.area}
                    onChange={handleAddressChange}
                    placeholder="Locality"
                    className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                  />
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">City</span>
                  <CitySelect
                    required
                    value={addressForm.city}
                    onChange={(city) => setAddressForm((prev) => ({ ...prev, city }))}
                    placeholder="City"
                    className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                  />
                </label>
              </div>

              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Pincode</span>
                <input
                  required
                  name="pincode"
                  value={addressForm.pincode}
                  onChange={handleAddressChange}
                  placeholder="6-digit pincode"
                  inputMode="numeric"
                  maxLength={6}
                  className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                />
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAddress(false)}
                  className="flex-1 rounded-xl border border-line px-4 py-3 font-medium"
                >
                  Cancel
                </button>
                <button type="button" onClick={saveAddress} className="flex-1 btn-primary">
                  Save Address
                </button>
              </div>
            </div>
          ) : (
            <div className="text-muted">
              {buildFullAddress(addressForm) || "No address set"}
            </div>
          )}
        </div>

        <div className="card-soft mt-6 p-6">
          <h3 className="mb-4 text-lg font-semibold">Payment Method</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["Cashfree", "UPI, cards, wallets"]].map(([name, description], index) => (
              <label
                key={name}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                  index === 0 ? "border-ink bg-bg-soft" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="pay"
                  defaultChecked={index === 0}
                  className="mt-1 accent-ink"
                />
                <div>
                  <div className="font-semibold">{name}</div>
                  <div className="text-xs text-muted">{description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="card-soft mt-6 p-6">
          <h3 className="mb-4 text-lg font-semibold">Benefits with this booking</h3>
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <FiTrash2 /> Clear
            </button>
          )}
        </div>
        <div className="grid gap-2 text-sm">
          {cart.length === 0 ? (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-muted">
              <span className="min-w-0 truncate">No services selected</span>
              <span className="whitespace-nowrap text-right">Rs. 0</span>
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
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-muted">
            <span className="min-w-0">Platform fee</span>
            <span className="whitespace-nowrap text-right">Rs. {fee}</span>
          </div>
        </div>

        <hr className="my-4 border-line" />

        <div className="grid gap-2 text-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <span className="text-muted">Pay at garage</span>
            <span className="whitespace-nowrap text-right font-semibold">
              Rs. {payAtGarageMin} - Rs. {payAtGarageMax}
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-base">
            <span className="font-semibold">Pay now</span>
            <span className="whitespace-nowrap text-right text-xl font-bold">
              Rs. {fee}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={pay}
          disabled={loading}
          className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FiLock /> {loading ? "Processing..." : `Pay Rs. ${fee} & Book Slot`}
        </button>
        <div className="mt-3 text-center text-xs text-muted">
          Secured by Cashfree. 100% refund on cancellation
        </div>
      </aside>
    </div>
  );
}
