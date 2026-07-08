import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import CitySelect from "@/components/common/CitySelect";
import {
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiEdit3,
  FiEye,
  FiImage,
  FiRefreshCw,
  FiStar,
  FiTrash2,
  FiX,
} from "react-icons/fi";

const applicationStatuses = [
  "PENDING",
  "CHANGES_REQUESTED",
  "APPROVED",
  "DENIED",
];

const applicationStatusMeta = {
  PENDING: { label: "Pending", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  CHANGES_REQUESTED: {
    label: "Changes requested",
    tone: "bg-blue-50 text-blue-700 border-blue-200",
  },
  APPROVED: { label: "Approved", tone: "bg-lime-100 text-ink border-lime-200" },
  DENIED: { label: "Denied", tone: "bg-red-50 text-red-700 border-red-200" },
};

const adminButtonBase =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-ink/10 disabled:cursor-not-allowed disabled:opacity-50";

const money = (value) => `₹${Number(value || 0).toLocaleString()}`;

const fieldClass =
  "h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink disabled:bg-bg-soft";

const getGarageBrands = (garage) => {
  const value = garage?.supportedBrands;
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const getCleanGarageDescription = (description = "") =>
  String(description || "")
    .split("\n")
    .filter((line) => !/^\s*(garage type|brands)\s*:/i.test(line))
    .join("\n")
    .trim();

const getGarageImageUrl = (image) => image?.imageUrl || image?.url || "";

const formatAdminDate = (value) => {
  if (!value) return "N/A";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

function ReviewStars({ rating = 0 }) {
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {[1, 2, 3, 4, 5].map((value) => (
        <FiStar
          key={value}
          fill={value <= Number(rating || 0) ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
}

function ReviewInspectionPhotos({ images = [], phase, label }) {
  const filtered = images
    .filter((image) => image.phase === phase)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  if (!filtered.length) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {filtered.map((image, index) => (
          <a
            key={image.id || `${phase}-${index}`}
            href={image.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-lg border border-line bg-bg-soft"
          >
            <img
              src={image.imageUrl}
              alt={`${label} ${index + 1}`}
              className="aspect-square w-full object-cover"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function Garages() {
  const { user } = useApp();
  const isIntern = user?.role === "INTERN";
  const [tab, setTab] = useState("applications");
  const [applications, setApplications] = useState([]);
  const [applicationStatus, setApplicationStatus] = useState("PENDING");
  const [garages, setGarages] = useState([]);
  const [services, setServices] = useState([]);
  const [vehicleBrands, setVehicleBrands] = useState([]);
  const [filterCity, setFilterCity] = useState("");
  const [selectedGarageId, setSelectedGarageId] = useState("");
  const [selectedGarageDetails, setSelectedGarageDetails] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    serviceId: "",
    vehicleBrand: "ALL",
    vehicleModel: "ALL",
  });
  const [noteByApplication, setNoteByApplication] = useState({});
  const [selectedApplicationIds, setSelectedApplicationIds] = useState([]);
  const [selectedGarageIds, setSelectedGarageIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedGarage = useMemo(
    () =>
      selectedGarageDetails ||
      garages.find((garage) => garage.id === selectedGarageId) ||
      null,
    [garages, selectedGarageDetails, selectedGarageId]
  );

  const canDeleteApplications =
    applicationStatus === "APPROVED" || applicationStatus === "DENIED";

  const allApplicationIds = applications.map((application) => application.id);
  const allGarageIds = garages.map((garage) => garage.id);

  const selectedVehicleBrand = vehicleBrands.find(
    (brand) => brand.name === serviceForm.vehicleBrand
  );

  const vehicleModels = selectedVehicleBrand?.models || [];

  const loadApplications = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await adminApi.getApplications(applicationStatus);
      setApplications(data || []);
      setSelectedApplicationIds([]);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load applications");
    } finally {
      setLoading(false);
    }
  };

  const loadGaragesAndServices = async () => {
    setLoading(true);
    setError("");

    try {
      const [garageList, serviceList] = await Promise.all([
        adminApi.getGarages(filterCity ? { city: filterCity } : {}),
        adminApi.getAssignableServices(),
      ]);

      setGarages(garageList || []);
      setServices(serviceList || []);

      setSelectedGarageId((current) =>
        current && garageList?.some((garage) => garage.id === current)
          ? current
          : ""
      );

      setSelectedGarageDetails((current) => {
        if (!current) return null;

        const refreshedGarage = garageList?.find(
          (garage) => garage.id === current.id,
        );

        return refreshedGarage
          ? {
              ...refreshedGarage,
              reviews: current.reviews || [],
            }
          : null;
      });

      setSelectedGarageIds((current) =>
        current.filter((id) => garageList?.some((garage) => garage.id === id))
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load garages/services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "applications") loadApplications();
    if (tab === "services") loadGaragesAndServices();
  }, [tab, applicationStatus]);

  useEffect(() => {
    if (tab !== "services") return;

    adminApi
      .getCarBrands()
      .then((brands) => setVehicleBrands(Array.isArray(brands) ? brands : []))
      .catch(() => setVehicleBrands([]));
  }, [tab]);

  const runApplicationAction = async (application, action) => {
    setError("");
    setSuccess("");

    const note = noteByApplication[application.id] || "";

    try {
      if (action === "approve") {
        await adminApi.approveApplication(application.id, note);
      }

      if (action === "changes") {
        await adminApi.requestApplicationChanges(application.id, note);
      }

      if (action === "deny") {
        await adminApi.denyApplication(application.id, note);
      }

      setSuccess(
        `Application ${
          action === "changes" ? "sent for changes" : `${action}d`
        }.`
      );

      await loadApplications();
    } catch (err) {
      setError(err.response?.data?.message || `Unable to ${action} application`);
    }
  };

  const saveGarageService = async (event) => {
    event.preventDefault();

    if (!selectedGarageId) {
      setError("Select a garage before assigning a service.");
      return;
    }

    if (!serviceForm.serviceId) {
      setError("Select a service to assign.");
      return;
    }

    setError("");
    setSuccess("");

    try {
      await adminApi.saveGarageService(selectedGarageId, {
        serviceId: serviceForm.serviceId,
        vehicleBrand: serviceForm.vehicleBrand,
        vehicleModel: serviceForm.vehicleModel,
        isActive: true,
      });

      setSuccess("Garage service saved.");
      setServiceForm({
        serviceId: "",
        vehicleBrand: "ALL",
        vehicleModel: "ALL",
      });

      await loadGaragesAndServices();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save garage service");
    }
  };

  const removeGarageService = async (item) => {
    setError("");
    setSuccess("");

    try {
      await adminApi.removeGarageService(selectedGarageId, item.serviceId, {
        vehicleBrand: item.vehicleBrand || "ALL",
        vehicleModel: item.vehicleModel || "ALL",
      });

      setSuccess("Garage service removed.");
      await loadGaragesAndServices();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to remove garage service");
    }
  };

  const editGarageService = (item) => {
    setServiceForm({
      serviceId: item.serviceId,
      vehicleBrand: item.vehicleBrand || "ALL",
      vehicleModel: item.vehicleModel || "ALL",
    });
  };

  const openGarageDetails = async (garageId) => {
    setSelectedGarageId(garageId);
    setError("");

    try {
      const data = await adminApi.getGarage(garageId);
      setSelectedGarageDetails(data);
    } catch (err) {
      setSelectedGarageDetails(null);
      setError(err.response?.data?.message || "Unable to load garage details");
    }
  };

  const toggleApplicationSelection = (applicationId) => {
    setSelectedApplicationIds((current) =>
      current.includes(applicationId)
        ? current.filter((id) => id !== applicationId)
        : [...current, applicationId]
    );
  };

  const deleteApplications = async (applicationIds) => {
    if (!applicationIds.length) return;

    setError("");
    setSuccess("");

    try {
      const result = await adminApi.deleteApplications(applicationIds);
      const deleted = result.deleted || applicationIds.length;

      setSuccess(`${deleted} application${deleted === 1 ? "" : "s"} deleted.`);
      await loadApplications();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete applications");
    }
  };

  const toggleGarageSelection = (garageId) => {
    setSelectedGarageIds((current) =>
      current.includes(garageId)
        ? current.filter((id) => id !== garageId)
        : [...current, garageId]
    );
  };

  const deleteGarages = async (garageIds) => {
    if (!garageIds.length) return;

    setError("");
    setSuccess("");

    try {
      const result = await adminApi.deleteGarages(garageIds);
      const deleted = result.deletedGarages || garageIds.length;

      setSuccess(
        `${deleted} garage${deleted === 1 ? "" : "s"} and related DB records deleted.`
      );

      setSelectedGarageIds([]);

      if (garageIds.includes(selectedGarageId)) {
        setSelectedGarageId("");
        setSelectedGarageDetails(null);
      }

      await loadGaragesAndServices();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete garages");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">Garages</h2>
          <p className="mt-1 text-sm text-muted">
            Approve garage applications and assign services.
          </p>
        </div>

        <div className="flex rounded-2xl border border-line bg-white p-1 shadow-sm">
          {[
            ["applications", "Applications"],
            ["services", "Garages"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                "rounded-xl px-4 py-2 text-sm font-bold transition",
                tab === id
                  ? "bg-ink text-white shadow-sm"
                  : "text-muted hover:bg-bg-soft hover:text-ink",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <FiCheckCircle className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {tab === "applications" ? (
        <div className="space-y-4">
          <section className="card-soft rounded-2xl p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {applicationStatuses.map((status) => {
                  const meta = applicationStatusMeta[status];

                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setApplicationStatus(status)}
                      className={[
                        "rounded-xl border px-4 py-2 text-xs font-black uppercase tracking-wide transition sm:text-sm",
                        applicationStatus === status
                          ? "border-ink bg-ink text-white shadow-sm"
                          : `${meta.tone} hover:-translate-y-0.5 hover:shadow-sm`,
                      ].join(" ")}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={loadApplications}
                  disabled={loading}
                  className={`${adminButtonBase} border border-line bg-white text-ink hover:border-ink hover:bg-bg-soft`}
                >
                  <FiRefreshCw className={loading ? "animate-spin" : ""} />
                  Refresh
                </button>

                {canDeleteApplications && applications.length > 0 && (
                  <>
                    <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-muted transition hover:bg-bg-soft">
                      <input
                        type="checkbox"
                        checked={
                          selectedApplicationIds.length === applications.length
                        }
                        onChange={(event) =>
                          setSelectedApplicationIds(
                            event.target.checked ? allApplicationIds : []
                          )
                        }
                      />
                      Select all
                    </label>

                    <button
                      type="button"
                      onClick={() => deleteApplications(selectedApplicationIds)}
                      disabled={!selectedApplicationIds.length}
                      className={`${adminButtonBase} bg-red-50 text-red-700 hover:bg-red-100`}
                    >
                      <FiTrash2 />
                      Delete selected
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteApplications(allApplicationIds)}
                      className={`${adminButtonBase} bg-red-700 text-white hover:bg-red-800`}
                    >
                      <FiTrash2 />
                      Delete all
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-3">
            {loading ? (
              <div className="card-soft rounded-2xl p-5 text-sm text-muted">
                Loading applications...
              </div>
            ) : applications.length ? (
              applications.map((application) => (
                <section
                  key={application.id}
                  className="card-soft rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      {canDeleteApplications && (
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-muted">
                          <input
                            type="checkbox"
                            checked={selectedApplicationIds.includes(
                              application.id
                            )}
                            onChange={() =>
                              toggleApplicationSelection(application.id)
                            }
                          />
                          Select
                        </label>
                      )}

                      <div>
                        <h3 className="text-lg font-bold text-ink">
                          {application.garageName}
                        </h3>

                        <p className="mt-1 text-sm text-muted">
                          {application.ownerName} · {application.email} ·{" "}
                          {application.phone}
                        </p>
                      </div>

                      <p className="break-words text-sm text-ink">
                        {application.address}, {application.area},{" "}
                        {application.city}
                      </p>

                      <p className="text-sm text-muted">
                        Radius: {application.workingRadiusKm || 15} km ·
                        Lat/Lng: {application.latitude ?? "N/A"},{" "}
                        {application.longitude ?? "N/A"}
                      </p>

                      {application.description && (
                        <p className="whitespace-pre-wrap text-sm text-muted">
                          {application.description}
                        </p>
                      )}

                      {application.images?.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4 lg:grid-cols-6">
                          {application.images.map((image, index) => (
                            <a
                              key={image.id}
                              href={getGarageImageUrl(image)}
                              target="_blank"
                              rel="noreferrer"
                              className="block overflow-hidden rounded-xl border border-line bg-bg-soft"
                            >
                              <img
                                src={getGarageImageUrl(image)}
                                alt={`${application.garageName} ${index + 1}`}
                                className="aspect-square w-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <span
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide",
                        applicationStatusMeta[application.status]?.tone ||
                          "border-line bg-bg-soft text-muted",
                      ].join(" ")}
                    >
                      {applicationStatusMeta[application.status]?.label ||
                        application.status}
                    </span>
                  </div>

                  {application.status !== "APPROVED" &&
                    application.status !== "DENIED" && (
                      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto]">
                        <input
                          value={noteByApplication[application.id] || ""}
                          onChange={(event) =>
                            setNoteByApplication({
                              ...noteByApplication,
                              [application.id]: event.target.value,
                            })
                          }
                          placeholder="Optional admin note"
                          className={fieldClass}
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              runApplicationAction(application, "approve")
                            }
                            className={`${adminButtonBase} bg-lime-400 text-black shadow-sm hover:-translate-y-0.5 hover:bg-lime-500`}
                          >
                            <FiCheck />
                            Approve
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              runApplicationAction(application, "changes")
                            }
                            className={`${adminButtonBase} border border-line bg-white text-ink hover:-translate-y-0.5 hover:border-ink hover:bg-bg-soft`}
                          >
                            <FiEdit3 />
                            Changes
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              runApplicationAction(application, "deny")
                            }
                            className={`${adminButtonBase} bg-red-700 text-white hover:-translate-y-0.5 hover:bg-red-800`}
                          >
                            <FiX />
                            Deny
                          </button>
                        </div>
                      </div>
                    )}
                </section>
              ))
            ) : (
              <div className="card-soft rounded-2xl p-5 text-sm text-muted">
                No applications found.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="card-soft overflow-hidden rounded-2xl shadow-sm">
            <div className="border-b border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-ink">Garage List</h3>
                  <p className="mt-1 text-xs text-muted">
                    Select a garage to view details.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadGaragesAndServices}
                  disabled={loading}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiRefreshCw className={loading ? "animate-spin" : ""} />
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                <CitySelect
                  value={filterCity}
                  onChange={setFilterCity}
                  includeInactive
                  placeholder="Filter garages by city"
                  className={fieldClass}
                />

                <button
                  type="button"
                  onClick={loadGaragesAndServices}
                  className={`${adminButtonBase} border border-line bg-white text-ink hover:border-ink hover:bg-bg-soft`}
                >
                  Apply filter
                </button>
              </div>

              {!isIntern && garages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-muted transition hover:bg-bg-soft">
                    <input
                      type="checkbox"
                      checked={selectedGarageIds.length === garages.length}
                      onChange={(event) =>
                        setSelectedGarageIds(
                          event.target.checked ? allGarageIds : []
                        )
                      }
                    />
                    Select all
                  </label>

                  <button
                    type="button"
                    onClick={() => deleteGarages(selectedGarageIds)}
                    disabled={!selectedGarageIds.length}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiTrash2 />
                    Delete
                  </button>
                </div>
              )}
            </div>

            <div className="max-h-[520px] overflow-y-auto">
              {garages.length ? (
                garages.map((garage) => (
                  <div
                    key={garage.id}
                    className={[
                      "flex items-start gap-3 border-b border-line p-3 transition",
                      selectedGarageId === garage.id
                        ? "bg-ink text-white"
                        : "hover:bg-bg-soft",
                    ].join(" ")}
                  >
                    {!isIntern && (
                      <input
                        type="checkbox"
                        checked={selectedGarageIds.includes(garage.id)}
                        onChange={() => toggleGarageSelection(garage.id)}
                        className="mt-1"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => openGarageDetails(garage.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-semibold">
                          {garage.name}
                        </span>
                        <FiEye className="shrink-0" />
                      </div>

                      <div
                        className={[
                          "mt-1 text-xs",
                          selectedGarageId === garage.id
                            ? "text-white/70"
                            : "text-muted",
                        ].join(" ")}
                      >
                        {garage.city} · {garage.services?.length || 0} services
                        · {garage.isActive ? "Active" : "Inactive"}
                      </div>
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 text-sm text-muted">No garages found.</div>
              )}
            </div>
          </aside>

          <main className="min-w-0 space-y-4">
            <section className="card-soft rounded-2xl p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words text-xl font-bold text-ink">
                    {selectedGarage?.name || "Select a garage"}
                  </h3>

                  {selectedGarage && (
                    <p className="mt-1 break-words text-sm text-muted">
                      {selectedGarage.address}, {selectedGarage.area},{" "}
                      {selectedGarage.city}
                    </p>
                  )}
                </div>

                {selectedGarage && (
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-bold text-ink">
                      {selectedGarage.isVerified ? "Verified" : "Unverified"}
                    </span>

                    <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-bold text-ink">
                      {selectedGarage.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                )}
              </div>

              {selectedGarage && (
                <p className="mt-2 text-sm text-muted">
                  Wallet:{" "}
                  <span className="font-semibold text-ink">
                    {money(selectedGarage.wallet?.balance)}
                  </span>
                </p>
              )}
            </section>

            {selectedGarage && (
              <section className="card-soft space-y-4 rounded-2xl p-4 shadow-sm">
                <div>
                  <h4 className="font-bold text-ink">Garage Details</h4>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
                    {getCleanGarageDescription(selectedGarage.description) ||
                      "No garage description submitted."}
                  </p>
                </div>

                <div className="grid gap-3 text-sm text-muted sm:grid-cols-2 lg:grid-cols-3">
                  <span>
                    <strong className="text-ink">Garage type:</strong>{" "}
                    {selectedGarage.garageType === "AUTHORIZED"
                      ? "Authorized"
                      : "Multi-brand"}
                  </span>
                  <span>
                    <strong className="text-ink">Brands catered:</strong>{" "}
                    {getGarageBrands(selectedGarage).length
                      ? getGarageBrands(selectedGarage).join(", ")
                      : "No brands selected"}
                  </span>
                  <span>
                    <strong className="text-ink">Owner:</strong>{" "}
                    {selectedGarage.owner?.name || "N/A"}
                  </span>
                  <span>
                    <strong className="text-ink">Owner email:</strong>{" "}
                    {selectedGarage.owner?.email || "N/A"}
                  </span>
                  <span>
                    <strong className="text-ink">Owner phone:</strong>{" "}
                    {selectedGarage.owner?.phone || "N/A"}
                  </span>
                  <span>
                    <strong className="text-ink">Garage email:</strong>{" "}
                    {selectedGarage.email || "N/A"}
                  </span>
                  <span>
                    <strong className="text-ink">Garage phone:</strong>{" "}
                    {selectedGarage.phone || "N/A"}
                  </span>
                  <span>
                    <strong className="text-ink">WhatsApp:</strong>{" "}
                    {selectedGarage.whatsappNo || "N/A"}
                  </span>
                  <span>
                    <strong className="text-ink">City:</strong>{" "}
                    {selectedGarage.city || "N/A"}
                  </span>
                  <span>
                    <strong className="text-ink">Area:</strong>{" "}
                    {selectedGarage.area || "N/A"}
                  </span>
                  <span>
                    <strong className="text-ink">Radius:</strong>{" "}
                    {selectedGarage.workingRadiusKm || 15} km
                  </span>
                  <span>
                    <strong className="text-ink">Latitude:</strong>{" "}
                    {selectedGarage.latitude ?? "N/A"}
                  </span>
                  <span>
                    <strong className="text-ink">Longitude:</strong>{" "}
                    {selectedGarage.longitude ?? "N/A"}
                  </span>
                  <span>
                    <strong className="text-ink">Hours:</strong>{" "}
                    {selectedGarage.openingTime || "N/A"} -{" "}
                    {selectedGarage.closingTime || "N/A"}
                  </span>
                  <span>
                    <strong className="text-ink">Rating:</strong>{" "}
                    {selectedGarage.ratingAvg || 0} (
                    {selectedGarage.ratingCount || 0})
                  </span>
                  <span>
                    <strong className="text-ink">Application:</strong>{" "}
                    {selectedGarage.applicationId || "N/A"}
                  </span>
                  <span>
                    <strong className="text-ink">Created:</strong>{" "}
                    {selectedGarage.createdAt
                      ? new Date(selectedGarage.createdAt).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2 text-sm font-bold text-ink">
                  <FiImage />
                  Uploaded Garage Photos ({selectedGarage.images?.length || 0}
                  /15)
                </div>

                {selectedGarage.images?.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {selectedGarage.images.map((image, index) => (
                      <a
                        key={image.id}
                        href={getGarageImageUrl(image)}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl border border-line bg-bg-soft"
                      >
                        <img
                          src={getGarageImageUrl(image)}
                          alt={`${selectedGarage.name} garage photo ${index + 1}`}
                          className="aspect-square w-full object-cover"
                        />
                        <div className="px-2 py-1 text-xs text-muted">
                          Photo {index + 1}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-bg-soft p-4 text-sm text-muted">
                    No garage photos were submitted during onboarding.
                  </div>
                )}

                <div className="border-t border-line pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-ink">Customer Reviews</h4>
                      <p className="mt-1 text-sm text-muted">
                        Individual reviews, linked booking details, and vehicle
                        inspection evidence.
                      </p>
                    </div>
                    <div className="rounded-full bg-bg-soft px-3 py-1.5 text-sm font-semibold text-ink">
                      {Number(selectedGarage.ratingAvg || 0).toFixed(1)} average ·{" "}
                      {selectedGarage.ratingCount || 0} reviews
                    </div>
                  </div>

                  {selectedGarage.reviews?.length > 0 ? (
                    <div className="mt-4 grid gap-4">
                      {selectedGarage.reviews.map((review) => {
                        const booking = review.booking || {};
                        const services =
                          booking.services
                            ?.map((item) => item.service?.name)
                            .filter(Boolean)
                            .join(", ") || "Service details unavailable";
                        const inspectionImages =
                          booking.inspectionImages || [];

                        return (
                          <article
                            key={review.id}
                            className="rounded-2xl border border-line bg-white p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <ReviewStars rating={review.rating} />
                                  <span className="text-sm font-bold text-ink">
                                    {review.rating}/5
                                  </span>
                                </div>
                                <p className="mt-2 font-semibold text-ink">
                                  {review.user?.name || "Customer"}
                                </p>
                                <p className="text-xs text-muted">
                                  {review.user?.email || review.user?.phone || "Customer contact unavailable"}
                                </p>
                              </div>

                              <div className="text-left text-xs text-muted sm:text-right">
                                <p>Booking #{booking.bookingCode || "N/A"}</p>
                                <p>{formatAdminDate(review.createdAt)}</p>
                              </div>
                            </div>

                            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-bg-soft p-3 text-sm text-ink">
                              {review.comment || "No written comment submitted."}
                            </p>

                            <div className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2">
                              <p>
                                <strong className="text-ink">Vehicle:</strong>{" "}
                                {[
                                  booking.vehicle?.brand,
                                  booking.vehicle?.model,
                                  booking.vehicle?.registrationNumber,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "N/A"}
                              </p>
                              <p>
                                <strong className="text-ink">Services:</strong>{" "}
                                {services}
                              </p>
                            </div>

                            {inspectionImages.length > 0 && (
                              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                <ReviewInspectionPhotos
                                  images={inspectionImages}
                                  phase="PICKUP"
                                  label="Pickup photos"
                                />
                                <ReviewInspectionPhotos
                                  images={inspectionImages}
                                  phase="DELIVERY"
                                  label="Delivery photos"
                                />
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl bg-bg-soft p-4 text-sm text-muted">
                      No customer reviews have been submitted for this garage.
                    </div>
                  )}
                </div>
              </section>
            )}

            <form
              onSubmit={saveGarageService}
              className="card-soft grid gap-3 rounded-2xl p-4 shadow-sm xl:grid-cols-[1fr_1.2fr_0.9fr_0.9fr_auto]"
            >
              <select
                required
                value={selectedGarageId}
                onChange={(event) => {
                  setSelectedGarageId(event.target.value);
                  setSelectedGarageDetails(null);
                }}
                className={fieldClass}
              >
                <option value="">Select garage</option>
                {garages.map((garage) => (
                  <option key={garage.id} value={garage.id}>
                    {garage.name}
                    {garage.city ? ` - ${garage.city}` : ""}
                  </option>
                ))}
              </select>

              <select
                required
                value={serviceForm.serviceId}
                onChange={(event) =>
                  setServiceForm({
                    ...serviceForm,
                    serviceId: event.target.value,
                  })
                }
                className={fieldClass}
              >
                <option value="">Select service</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.category?.name
                      ? `${service.category.name} - `
                      : ""}
                    {service.name}
                  </option>
                ))}
              </select>

              <select
                value={serviceForm.vehicleBrand}
                onChange={(event) =>
                  setServiceForm({
                    ...serviceForm,
                    vehicleBrand: event.target.value,
                    vehicleModel: "ALL",
                  })
                }
                className={fieldClass}
              >
                <option value="ALL">All brands</option>
                {vehicleBrands.map((brand) => (
                  <option key={brand.id || brand.name} value={brand.name}>
                    {brand.name}
                  </option>
                ))}
              </select>

              <select
                value={serviceForm.vehicleModel}
                onChange={(event) =>
                  setServiceForm({
                    ...serviceForm,
                    vehicleModel: event.target.value,
                  })
                }
                disabled={serviceForm.vehicleBrand === "ALL"}
                className={fieldClass}
              >
                <option value="ALL">All models</option>
                {vehicleModels.map((model) => (
                  <option key={model.id || model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={!selectedGarageId || !serviceForm.serviceId}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-lime-400 px-5 text-sm font-bold text-black transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save
              </button>
            </form>

            <section className="card-soft overflow-hidden rounded-2xl shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      {["Service", "Category", "Vehicle Scope", "Actions"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="whitespace-nowrap px-4 py-3 font-bold"
                          >
                            {heading}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {selectedGarage?.services?.length ? (
                      selectedGarage.services.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-line transition hover:bg-bg-soft/70"
                        >
                          <td className="px-4 py-3 font-semibold text-ink">
                            {item.service?.name}
                          </td>

                          <td className="px-4 py-3 text-muted">
                            {item.service?.category?.name || "General"}
                          </td>

                          <td className="px-4 py-3 text-muted">
                            {item.vehicleBrand === "ALL"
                              ? "All brands / all models"
                              : `${item.vehicleBrand || "All brands"} / ${
                                  item.vehicleModel === "ALL"
                                    ? "All models"
                                    : item.vehicleModel || "All models"
                                }`}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => editGarageService(item)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <FiEdit3 />
                              </button>

                              <button
                                type="button"
                                onClick={() => removeGarageService(item)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700 transition hover:bg-red-100"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-4 py-6 text-sm text-muted">
                          No services assigned yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      )}
    </div>
  );
}