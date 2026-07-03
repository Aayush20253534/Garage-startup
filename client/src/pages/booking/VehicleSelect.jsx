import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FUEL_TYPES } from "@/data/vehicles";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import { FiArrowRight, FiCheck, FiPlus, FiTruck } from "react-icons/fi";

export default function VehicleSelect() {
  const nav = useNavigate();

  const {
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

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [brandLoading, setBrandLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaultLoadingId, setDefaultLoadingId] = useState(null);
  const [error, setError] = useState("");

  const currentVehicles = Array.isArray(vehicles) ? vehicles : [];
  const hasVehicles = currentVehicles.length > 0;

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
        image: item.logoUrl || null,
        models: item.models || [],
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

      if (safeList.length > 0) {
        setShowForm(false);
      } else {
        setShowForm(true);
        await loadVehicleBrands();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load vehicles");
      setShowForm(true);
      await loadVehicleBrands();
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

  const selectBrand = (selectedBrand) => {
    setBrand(selectedBrand);
    setModel(null);
  };

  const handleSetDefault = async (selectedVehicle) => {
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
    if (!vehicle && currentVehicles.length > 0) {
      syncVehicleState(currentVehicles);
    }

    nav("/booking/services");
  };

  const confirm = async () => {
    if (!brand || !model || !fuel || !year) {
      setError("Please select brand, model, fuel type, and year");
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
      <div className="container-x max-w-4xl py-12">
        <div className="card-soft p-8 text-muted">
          Loading vehicle details...
        </div>
      </div>
    );
  }

  if (hasVehicles && !showForm) {
    return (
      <div className="container-x max-w-5xl py-12">
        <div className="mb-2 flex items-center gap-3">
          <span className="chip-brand">Step 1 of 3</span>
        </div>

        <h1 className="text-3xl font-bold sm:text-5xl">Select your vehicle</h1>

        <p className="mt-2 text-muted">
          Choose a saved vehicle or add a new one before picking services.
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {currentVehicles.map((item) => {
            const isActive = vehicle?.id === item.id || item.isDefault;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSetDefault(item)}
                disabled={defaultLoadingId === item.id}
                className={`card-soft p-5 text-left transition hover:-translate-y-1 ${
                  isActive ? "ring-2 ring-ink" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand">
                    <FiTruck />
                  </span>

                  <div>
                    <div className="font-semibold">
                      {item.brand} {item.model}
                    </div>

                    <div className="text-xs text-muted">
                      {item.fuelType || "Fuel"} -{" "}
                      {item.registrationNumber || "No registration"}
                    </div>

                    <div className="text-xs text-muted">Year: {item.year}</div>
                  </div>
                </div>

                <div className="mt-4">
                  {isActive ? (
                    <span className="chip-brand inline-flex">
                      <FiCheck /> Selected
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-ink">
                      {defaultLoadingId === item.id
                        ? "Selecting..."
                        : "Select vehicle"}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={continueToServices}
            className="btn-primary"
          >
            Continue to Services <FiArrowRight />
          </button>

          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-ghost"
          >
            <FiPlus />
            Add New Vehicle
          </button>

          <Link to="/dashboard" className="btn-ghost">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x max-w-4xl py-12">
      <div className="mb-2 flex items-center gap-3">
        <span className="chip-brand">Step 1 of 3</span>

        {hasVehicles && (
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="text-sm font-medium text-ink hover:underline"
          >
            Use saved vehicle
          </button>
        )}
      </div>

      <h1 className="text-3xl font-bold sm:text-5xl">
        Which car do you drive?
      </h1>

      <p className="mt-2 text-muted">
        We'll tailor services specifically for your vehicle.
      </p>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {brandLoading ? (
        <div className="card-soft mt-8 p-8 text-muted">
          Loading vehicle brands...
        </div>
      ) : (
        <div className="mt-10 grid gap-6">
          <Block title="Select Brand" done={!!brand} value={brand?.name}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {brands.map((b) => {
                const Icon = b.icon;

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => selectBrand(b)}
                    className={`flex min-h-36 flex-col items-center justify-center rounded-2xl border p-4 text-center transition ${
                      brand?.id === b.id
                        ? "border-brand bg-brand-soft text-ink ring-2 ring-brand"
                        : "border-line bg-white hover:border-ink"
                    }`}
                  >
                    {b.image ? (
                      <img
                        src={b.image}
                        alt={b.name}
                        className="mb-3 h-12 max-w-28 object-contain"
                      />
                    ) : Icon ? (
                      <Icon className="mb-3 h-12 w-12" />
                    ) : (
                      <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand font-bold text-ink">
                        {b.name.charAt(0)}
                      </div>
                    )}

                    <div className="w-full text-sm font-semibold leading-tight">
                      {b.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </Block>

          {brand && (
            <Block title="Select Model" done={!!model} value={model?.name}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {brand.models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModel(m)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      model?.id === m.id
                        ? "border-ink bg-ink text-white"
                        : "border-line hover:border-ink"
                    }`}
                  >
                    <div className="font-semibold">
                      {brand.name} {m.name}
                    </div>
                  </button>
                ))}
              </div>
            </Block>
          )}

          {model && (
            <Block title="Select Fuel" done={!!fuel} value={fuel?.label}>
              <div className="flex flex-wrap gap-3">
                {FUEL_TYPES.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFuel(f)}
                    className={`rounded-full border px-5 py-3 text-sm font-medium transition ${
                      fuel?.value === f.value
                        ? "border-ink bg-ink text-white"
                        : "border-line hover:border-ink"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </Block>
          )}

          {brand && model && fuel && (
            <Block title="Vehicle Details" done={!!year} value={year}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Year</span>
                  <input
                    required
                    type="number"
                    value={year}
                    min={1990}
                    max={new Date().getFullYear() + 1}
                    onChange={(e) => setYear(e.target.value)}
                    className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                  />
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">
                    Registration Number{" "}
                    <span className="text-muted">(optional)</span>
                  </span>
                  <input
                    value={registrationNumber}
                    onChange={(e) =>
                      setRegistrationNumber(e.target.value.toUpperCase())
                    }
                    placeholder="DL 3C AB 1234"
                    className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                  />
                </label>
              </div>
            </Block>
          )}

          {brand && model && fuel && year && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-soft p-6"
            >
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand p-2">
                  {brand.image ? (
                    <img
                      src={brand.image}
                      alt={brand.name}
                      className="h-8 w-8 object-contain"
                    />
                  ) : brand.icon ? (
                    <brand.icon className="h-8 w-8 text-ink" />
                  ) : (
                    <span className="font-bold">{brand.name.charAt(0)}</span>
                  )}
                </span>

                <div className="flex-1">
                  <div className="text-xs text-muted">Your vehicle</div>

                  <div className="text-xl font-bold">
                    {brand.name} {model.name}
                  </div>

                  <div className="text-sm text-muted">
                    {fuel.label} - {year}
                    {registrationNumber ? ` - ${registrationNumber}` : ""}
                  </div>
                </div>

                <span className="chip-brand">
                  Great! Services tailored for you.
                </span>
              </div>

              <button
                type="button"
                onClick={confirm}
                disabled={saving}
                className="btn-primary mt-5 w-full sm:w-auto"
              >
                {saving ? "Saving..." : "Continue to Services"}
                {!saving && <FiArrowRight />}
              </button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ title, done, value, children }) {
  return (
    <div className="card-soft p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>

        {done && (
          <span className="chip flex items-center gap-1">
            <FiCheck /> {value}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}
