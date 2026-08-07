import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FUEL_TYPES } from "@/data/vehicles";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import SafeImage from "@/components/common/SafeImage";
import RegistrationVerificationField from "@/components/vehicle/RegistrationVerificationField";
import { getOptimizedImageUrl } from "@/utils/imageCache";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheck,
  FiPlus,
  FiTruck,
} from "react-icons/fi";

const inputClass =
  "h-10 w-full rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink";
const ACTIVE_VEHICLE_BOOKING_STATUSES = [
  "PENDING_PAYMENT",
  "PENDING_VERIFICATION",
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
];

const getVehicleName = (vehicle) =>
  `${vehicle?.brand || ""} ${vehicle?.model || ""}`.trim() ||
  vehicle?.registrationNumber ||
  "This vehicle";

const getActiveBookingPath = (booking) =>
  booking?.status === "PENDING_PAYMENT"
    ? "/dashboard/pending-bookings"
    : booking?.status === "PENDING_VERIFICATION"
      ? `/booking/verification/${booking.id}`
    : "/dashboard/bookings";

const getActiveBookingLabel = (booking) =>
  booking?.bookingCode || booking?.id || "active booking";

export default function VehicleSelect() {
  const nav = useNavigate();
  const modelSectionRef = useRef(null);
  const fuelSectionRef = useRef(null);
  const detailsSectionRef = useRef(null);

  const {
    user,
    vehicle,
    vehicles,
    setVehicle,
    setVehicles,
    fetchVehicles,
    fetchMe,
    clearDashboardCache,
    clearVehiclesCache,
  } = useApp();

  const [brands, setBrands] = useState([]);
  const [brand, setBrand] = useState(null);
  const [model, setModel] = useState(null);
  const [fuel, setFuel] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [registrationVerified, setRegistrationVerified] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [brandLoading, setBrandLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaultLoadingId, setDefaultLoadingId] = useState(null);
  const [activeBookingsByVehicleId, setActiveBookingsByVehicleId] = useState({});
  const [error, setError] = useState("");

  const currentVehicles = Array.isArray(vehicles) ? vehicles : [];
  const hasVehicles = currentVehicles.length > 0;
  const vehicleIdsKey = currentVehicles.map((item) => item.id).join(",");
  const selectedActiveBooking = vehicle?.id
    ? activeBookingsByVehicleId[vehicle.id]
    : null;
  const registrationRequired = user?.vehicleRegistrationRequired === true;

  const syncVehicleState = (list = []) => {
    const safeList = Array.isArray(list) ? list : [];

    setVehicles?.(safeList);

    const defaultVehicle =
      safeList.find((item) => item.isDefault) || safeList[0] || null;

    setVehicle?.(defaultVehicle);

    return safeList;
  };

  const loadVehicleBrands = async () => {
    try {
      setError("");
      setBrandLoading(true);

      const res = await api.get("/vehicle-meta/brands");
      const backendBrands = res.data.data || [];

      const mappedBrands = backendBrands.map((item) => ({
        ...item,
        icon: null,
        image: getOptimizedImageUrl(item.logoUrl, { width: 192 }),
        models: (item.models || []).map((catalogModel) => ({
          ...catalogModel,
          image: getOptimizedImageUrl(catalogModel.imageUrl, { width: 480 }),
        })),
      }));

      setBrands(mappedBrands);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load vehicle brands");
    } finally {
      setBrandLoading(false);
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      const list = fetchVehicles ? await fetchVehicles({ force: true }) : [];
      const safeList = syncVehicleState(list || []);

      await loadVehicleBrands();

      if (safeList.length > 0) {
        setShowForm(false);
      } else {
        setShowForm(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load vehicles");
      setShowForm(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (showForm && brands.length === 0) {
      loadVehicleBrands();
    }
  }, [showForm]);

  useEffect(() => {
    let mounted = true;

    if (!hasVehicles) {
      setActiveBookingsByVehicleId({});

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

        const nextActiveBookings = {};

        (response.data?.data || []).forEach((booking) => {
          const bookedVehicleId = booking.vehicleId || booking.vehicle?.id;

          if (bookedVehicleId) {
            nextActiveBookings[bookedVehicleId] = booking;
          }
        });

        setActiveBookingsByVehicleId(nextActiveBookings);
      })
      .catch(() => {
        if (mounted) setActiveBookingsByVehicleId({});
      });

    return () => {
      mounted = false;
    };
  }, [hasVehicles, vehicleIdsKey]);

  useEffect(() => {
    if (!hasVehicles || !vehicle?.id || !activeBookingsByVehicleId[vehicle.id]) {
      return;
    }

    const firstAvailableVehicle = currentVehicles.find(
      (item) => !activeBookingsByVehicleId[item.id],
    );

    if (firstAvailableVehicle) {
      setVehicle?.(firstAvailableVehicle);
    }
  }, [activeBookingsByVehicleId, hasVehicles, vehicle?.id, vehicleIdsKey]);

  const scrollToNextSection = (sectionRef) => {
    if (!window.matchMedia("(max-width: 639px)").matches) return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        sectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  };

  const selectBrand = (selectedBrand) => {
    setBrand(selectedBrand);
    setModel(null);
    setFuel(null);
    scrollToNextSection(modelSectionRef);
  };

  const selectModel = (selectedModel) => {
    setModel(selectedModel);
    setFuel(null);
    scrollToNextSection(fuelSectionRef);
  };

  const selectFuel = (selectedFuel) => {
    setFuel(selectedFuel);
    scrollToNextSection(detailsSectionRef);
  };

  const getCatalogModelForVehicle = (savedVehicle) => {
    const savedBrandName = String(savedVehicle?.brand || "")
      .trim()
      .toLowerCase();
    const savedModelName = String(savedVehicle?.model || "")
      .trim()
      .toLowerCase();
    const catalogBrand = brands.find(
      (item) => String(item.name || "").trim().toLowerCase() === savedBrandName,
    );

    return catalogBrand?.models?.find(
      (item) => String(item.name || "").trim().toLowerCase() === savedModelName,
    );
  };

  const handleSetDefault = async (selectedVehicle) => {
    const activeBooking = activeBookingsByVehicleId[selectedVehicle.id];

    if (activeBooking) {
      setError(
        `${getVehicleName(selectedVehicle)} already has ${getActiveBookingLabel(
          activeBooking,
        )}. Complete or cancel it before booking this vehicle again.`,
      );
      return;
    }

    try {
      setError("");
      setDefaultLoadingId(selectedVehicle.id);

      await api.patch(`/vehicles/${selectedVehicle.id}/default`);

      const updatedVehicles = currentVehicles.map((item) => ({
        ...item,
        isDefault: item.id === selectedVehicle.id,
      }));

      syncVehicleState(updatedVehicles);

      clearVehiclesCache?.();
      clearDashboardCache?.();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to set default vehicle");
    } finally {
      setDefaultLoadingId(null);
    }
  };

  const continueToServices = () => {
    let nextVehicle = vehicle;

    if (!nextVehicle && currentVehicles.length > 0) {
      nextVehicle =
        currentVehicles.find((item) => !activeBookingsByVehicleId[item.id]) ||
        currentVehicles[0];

      setVehicle?.(nextVehicle);
    }

    if (
      registrationRequired &&
      nextVehicle &&
      (!nextVehicle.registrationNumber || !nextVehicle.registrationVerified)
    ) {
      setError(
        "Verify this vehicle's registration number from My Vehicles before booking a service.",
      );
      return;
    }

    const blockingBooking = nextVehicle?.id
      ? activeBookingsByVehicleId[nextVehicle.id]
      : selectedActiveBooking;

    if (blockingBooking) {
      setError(
        `${getVehicleName(nextVehicle)} already has ${getActiveBookingLabel(
          blockingBooking,
        )}. Select another vehicle to book a new service.`,
      );
      return;
    }

    nav("/booking/services");
  };

  const confirm = async () => {
    if (!brand || !model || !fuel || !year) {
      setError("Please select brand, model, fuel type, and year");
      return;
    }

    const hasRegistrationNumber = Boolean(registrationNumber.trim());
    if (registrationRequired && !hasRegistrationNumber) {
      setError("Registration number verification is required for your account");
      return;
    }
    if (hasRegistrationNumber && !registrationVerified) {
      setError("Verify the registration number before continuing");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        brand: brand.name,
        model: model.name,
        year: Number(year),
        fuelType: fuel.value,
        registrationNumber: registrationNumber.trim() || null,
        isDefault: true,
      };

      const res = await api.post("/vehicles", payload);
      const createdVehicle = res.data.data;

      setVehicle(createdVehicle);

      let nextVehicles = [createdVehicle];
      const me = await fetchMe?.();

      if (me?.vehicles) {
        nextVehicles = me.vehicles;
      } else {
        nextVehicles = [...currentVehicles, createdVehicle];
      }

      syncVehicleState(nextVehicles);

      clearVehiclesCache?.();
      clearDashboardCache?.();

      nav("/booking/services");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save vehicle");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container-x max-w-4xl py-10">
        <div className="card-soft rounded-2xl p-5 text-sm text-muted">
          Loading vehicle details...
        </div>
      </div>
    );
  }

  if (hasVehicles && !showForm) {
    return (
      <div className="container-x max-w-6xl py-8 2xl:max-w-[96rem]">
        <div className="space-y-5">
          <div>
            <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-ink">
              Step 1 of 3
            </span>

            <h1 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">
              Select your vehicle
            </h1>

            <p className="mt-2 text-sm text-muted">
              Choose a saved vehicle or add a new one before picking services.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <FiAlertCircle className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {selectedActiveBooking && (
            <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <FiAlertCircle className="mt-0.5 shrink-0 text-amber-700" />
                <span>
                  {getVehicleName(vehicle)} already has{" "}
                  {getActiveBookingLabel(selectedActiveBooking)}. Select
                  another vehicle to book a new service.
                </span>
              </div>
              <button
                type="button"
                onClick={() => nav(getActiveBookingPath(selectedActiveBooking))}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-ink px-3 text-xs font-bold text-white transition hover:bg-ink-2"
              >
                View booking
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {currentVehicles.map((item) => {
              const isActive = vehicle?.id === item.id || item.isDefault;
              const isSelecting = defaultLoadingId === item.id;
              const activeBooking = activeBookingsByVehicleId[item.id];
              const catalogModel = getCatalogModelForVehicle(item);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSetDefault(item)}
                  disabled={isSelecting || Boolean(activeBooking)}
                  className={[
                    "card-soft rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70",
                    activeBooking
                      ? "border-amber-200 bg-amber-50"
                      : isActive
                      ? "border-brand bg-brand-soft/30"
                      : "border-line bg-white",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <SafeImage
                      src={catalogModel?.image}
                      alt={`${item.brand} ${item.model}`}
                      width="160"
                      height="112"
                      loading="lazy"
                      className="h-14 w-20 shrink-0 rounded-xl border border-line bg-white object-cover"
                      fallback={
                        <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-brand text-xl text-black">
                          <FiTruck />
                        </span>
                      }
                    />

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-ink">
                        {item.brand} {item.model}
                      </div>

                      <div className="mt-1 truncate text-xs text-muted">
                        {item.fuelType || "Fuel"} ·{" "}
                        {item.registrationNumber || "No registration"}
                      </div>

                      <div className="mt-1 text-xs text-muted">
                        Year: {item.year || "-"}
                      </div>
                      {item.registrationVerified && (
                        <div className="mt-1 text-[11px] font-bold text-green-700">
                          RC verified
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-line pt-4">
                    {activeBooking ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                        <FiAlertCircle />
                        Active booking
                      </span>
                    ) : isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold text-black">
                        <FiCheck />
                        Selected
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-ink">
                        {isSelecting ? "Selecting..." : "Select vehicle"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={continueToServices}
              disabled={Boolean(selectedActiveBooking)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {selectedActiveBooking
                ? "Complete active booking first"
                : "Continue to Services"}{" "}
              <FiArrowRight />
            </button>

            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
            >
              <FiPlus />
              Add New Vehicle
            </button>

            <Link
              to="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x max-w-5xl py-8 2xl:max-w-[88rem]">
      <div className="space-y-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-ink">
              Step 1 of 3
            </span>

            {hasVehicles && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm font-semibold text-ink hover:underline"
              >
                Use saved vehicle
              </button>
            )}
          </div>

          <h1 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">
            Which car do you drive?
          </h1>

          <p className="mt-2 text-sm text-muted">
            We'll tailor services specifically for your vehicle.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <FiAlertCircle className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {brandLoading ? (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            Loading vehicle brands...
          </div>
        ) : (
          <div className="grid gap-4">
            <Block title="Select Brand" done={!!brand} value={brand?.name}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {brands.map((b) => {
                  const Icon = b.icon;

                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => selectBrand(b)}
                      className={[
                        "flex min-h-28 flex-col items-center justify-center rounded-2xl border p-3 text-center transition hover:-translate-y-0.5",
                        brand?.id === b.id
                          ? "border-brand bg-brand-soft text-ink"
                          : "border-line bg-white hover:border-ink",
                      ].join(" ")}
                    >
                      <SafeImage
                        src={b.image}
                        alt={b.name}
                        width="192"
                        height="80"
                        loading="lazy"
                        decoding="async"
                        className="mb-3 h-10 max-w-24 object-contain"
                        fallback={
                          Icon ? (
                            <Icon className="mb-3 h-10 w-10" />
                          ) : (
                            <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand font-bold text-ink">
                              {b.name.charAt(0)}
                            </div>
                          )
                        }
                      />

                      <div className="w-full truncate text-sm font-bold text-ink">
                        {b.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Block>

            {brand && (
              <div ref={modelSectionRef} className="scroll-mt-24">
                <Block title="Select Model" done={!!model} value={model?.name}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {brand.models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectModel(m)}
                      className={[
                        "overflow-hidden rounded-xl border text-left text-sm transition",
                        model?.id === m.id
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-white text-ink hover:border-ink",
                      ].join(" ")}
                    >
                      <SafeImage
                        src={m.image}
                        alt={`${brand.name} ${m.name}`}
                        width="480"
                        height="270"
                        loading="lazy"
                        className="aspect-[16/9] w-full object-cover"
                        fallback={
                          <div
                            className={[
                              "grid aspect-[16/9] w-full place-items-center text-3xl",
                              model?.id === m.id
                                ? "bg-white/10 text-white"
                                : "bg-bg-soft text-muted",
                            ].join(" ")}
                          >
                            <FiTruck />
                          </div>
                        }
                      />
                      <div className="p-3 font-bold">
                        {brand.name} {m.name}
                      </div>
                    </button>
                  ))}
                </div>
                </Block>
              </div>
            )}

            {model && (
              <div ref={fuelSectionRef} className="scroll-mt-24">
                <Block title="Select Fuel" done={!!fuel} value={fuel?.label}>
                <div className="flex flex-wrap gap-2">
                  {FUEL_TYPES.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => selectFuel(f)}
                      className={[
                        "h-9 rounded-lg border px-3.5 text-sm font-semibold transition",
                        fuel?.value === f.value
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-white text-ink hover:border-ink",
                      ].join(" ")}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                </Block>
              </div>
            )}

            {brand && model && fuel && (
              <div ref={detailsSectionRef} className="scroll-mt-24">
                <Block title="Vehicle Details" done={!!year} value={year}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-semibold text-ink">
                    Year
                    <input
                      required
                      type="number"
                      value={year}
                      min={1990}
                      max={new Date().getFullYear() + 1}
                      onChange={(event) => setYear(event.target.value)}
                      className={inputClass}
                    />
                  </label>

                  <RegistrationVerificationField
                    value={registrationNumber}
                    onChange={setRegistrationNumber}
                    brand={brand?.name}
                    model={model?.name}
                    fuelType={fuel?.value}
                    required={registrationRequired}
                    onVerificationChange={setRegistrationVerified}
                  />
                </div>
                </Block>
              </div>
            )}

            {brand && model && fuel && year && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-soft rounded-2xl border border-brand bg-brand-soft/30 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white">
                    <SafeImage
                      src={model.image || brand.image}
                      alt={`${brand.name} ${model.name}`}
                      width="240"
                      height="160"
                      decoding="async"
                      className="h-full w-full object-cover"
                      fallback={
                        <FiTruck className="h-8 w-8 text-ink" />
                      }
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-muted">
                      Your vehicle
                    </div>

                    <div className="truncate text-xl font-bold text-ink">
                      {brand.name} {model.name}
                    </div>

                    <div className="text-sm text-muted">
                      {fuel.label} · {year}
                      {registrationNumber ? ` · ${registrationNumber}` : ""}
                      {registrationVerified ? " · RC verified" : ""}
                    </div>
                  </div>

                  <span className="w-fit rounded-full bg-brand px-3 py-1 text-xs font-bold text-black">
                    Tailored services ready
                  </span>
                </div>

                <button
                  type="button"
                  onClick={confirm}
                  disabled={saving}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {saving ? "Saving..." : "Continue to Services"}
                  {!saving && <FiArrowRight />}
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ title, done, value, children }) {
  return (
    <section className="card-soft rounded-2xl p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-ink">{title}</h3>

        {done && (
          <span className="inline-flex items-center gap-1 rounded-full bg-bg-soft px-3 py-1 text-xs font-bold text-muted">
            <FiCheck />
            {value}
          </span>
        )}
      </div>

      {children}
    </section>
  );
}
