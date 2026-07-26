import { useEffect, useMemo, useRef, useState } from "react";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import CitySelect from "@/components/common/CitySelect";
import { formatRupees } from "@/utils/priceRange";
import {
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiEdit3,
  FiEye,
  FiImage,
  FiPauseCircle,
  FiPlayCircle,
  FiRefreshCw,
  FiStar,
  FiTrash2,
  FiTruck,
  FiMapPin,
  FiUpload,
  FiArrowLeft,
  FiArrowRight,
  FiX,
} from "react-icons/fi";

const applicationStatuses = [
  "PENDING",
  "CHANGES_REQUESTED",
  "APPROVED",
  "DENIED",
];

const applicationStatusMeta = {
  PENDING: {
    label: "Pending review",
    tone: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  CHANGES_REQUESTED: {
    label: "Changes requested",
    tone: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  APPROVED: {
    label: "Approved",
    tone: "bg-lime-50 text-lime-900 border-lime-200",
    dot: "bg-lime-500",
  },
  DENIED: {
    label: "Denied",
    tone: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

const adminButtonBase =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-ink/10 disabled:cursor-not-allowed disabled:opacity-50";

const MAX_GARAGE_PHOTOS = 15;
const MAX_GARAGE_PHOTO_SIZE_MB = 2;
const MAX_GARAGE_PHOTO_SIZE_BYTES =
  MAX_GARAGE_PHOTO_SIZE_MB * 1024 * 1024;
const GARAGE_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const money = (value) => formatRupees(value);

const fieldClass =
  "h-10 min-w-0 rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/5 disabled:bg-bg-soft";

const createEmptyServiceForm = () => ({
  serviceId: "",
  vehicleBrand: "ALL",
  vehicleModel: "ALL",
  isExcluded: false,
  exclusionMode: "BRANDS",
  excludedBrands: [],
  excludedModels: [],
});

const formatGarageServiceScope = ({ vehicleBrand, vehicleModel }) => {
  const brandScope = String(vehicleBrand || "ALL").toUpperCase();
  const modelScope = String(vehicleModel || "ALL").toUpperCase();

  if (brandScope === "ALL") return "All brands / all models";
  if (modelScope === "ALL") return `${vehicleBrand} / All models`;
  return `${vehicleBrand} / ${vehicleModel}`;
};

const getGarageBrandField = (garage, field) => {
  const value = garage?.[field];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const getGarageBrands = (garage) =>
  getGarageBrandField(garage, "supportedBrands");

const getGarageExcludedServiceBrands = (garage) =>
  getGarageBrandField(garage, "excludedServiceBrands");

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
    .filter((item) => item.phase === phase)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const photos = filtered.filter((item) => item.mediaType !== "VIDEO");
  const videos = filtered.filter((item) => item.mediaType === "VIDEO");

  if (!filtered.length) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((image, index) => (
            <a
              key={image.id || `${phase}-photo-${index}`}
              href={image.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-lg border border-line bg-bg-soft"
            >
              <img
                src={image.imageUrl}
                alt={`${label} photo ${index + 1}`}
                className="aspect-square w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {videos.map((video, index) => (
        <video
          key={video.id || `${phase}-video-${index}`}
          src={video.imageUrl}
          controls
          preload="metadata"
          className="mt-3 max-h-72 w-full rounded-lg border border-line bg-black object-contain"
        />
      ))}
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
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [selectedGarageId, setSelectedGarageId] = useState("");
  const [selectedGarageDetails, setSelectedGarageDetails] = useState(null);
  const [serviceForm, setServiceForm] = useState(createEmptyServiceForm);
  const [noteByApplication, setNoteByApplication] = useState({});
  const [selectedApplicationIds, setSelectedApplicationIds] = useState([]);
  const [selectedGarageIds, setSelectedGarageIds] = useState([]);
  const [statusUpdatingGarageId, setStatusUpdatingGarageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingGarage, setEditingGarage] = useState(false);
  const [garageEditForm, setGarageEditForm] = useState(null);
  const [savingGarage, setSavingGarage] = useState(false);
  const [savingGarageService, setSavingGarageService] = useState(false);
  const garageServiceSaveInFlight = useRef(false);
  const [photoBusyId, setPhotoBusyId] = useState("");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [garageWideExcludedBrands, setGarageWideExcludedBrands] = useState([]);
  const [savingGarageWideExclusions, setSavingGarageWideExclusions] = useState(false);
  const [editingGarageWideExclusions, setEditingGarageWideExclusions] = useState(false);

  const selectedGarage = useMemo(
    () =>
      selectedGarageDetails ||
      garages.find((garage) => garage.id === selectedGarageId) ||
      null,
    [garages, selectedGarageDetails, selectedGarageId]
  );

  useEffect(() => {
    setGarageWideExcludedBrands(getGarageExcludedServiceBrands(selectedGarage));
  }, [selectedGarage?.id, selectedGarage?.excludedServiceBrands]);

  useEffect(() => {
    setEditingGarageWideExclusions(false);
  }, [selectedGarage?.id]);

  const allGaragePhotoIds = (selectedGarage?.images || []).map(
    (image) => image.id,
  );
  const allGaragePhotosSelected =
    allGaragePhotoIds.length > 0 &&
    allGaragePhotoIds.every((imageId) => selectedPhotoIds.includes(imageId));

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
      const garageParams = {
        ...(filterCity && { city: filterCity }),
        ...(filterStatus !== "ALL" && {
          isActive: filterStatus === "ACTIVE",
        }),
      };
      const [garageList, serviceList] = await Promise.all([
        adminApi.getGarages(garageParams),
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

    if (garageServiceSaveInFlight.current) return;

    if (!selectedGarageId) {
      setError("Select a garage before assigning a service.");
      return;
    }

    if (!serviceForm.serviceId) {
      setError("Select a service to assign.");
      return;
    }

    const exclusionScopes = serviceForm.isExcluded
      ? serviceForm.exclusionMode === "BRANDS"
        ? serviceForm.excludedBrands.map((vehicleBrand) => ({
            vehicleBrand,
            vehicleModel: "ALL",
          }))
        : serviceForm.excludedModels.map((vehicleModel) => ({
            vehicleBrand: serviceForm.vehicleBrand,
            vehicleModel,
          }))
      : [];

    if (serviceForm.isExcluded && exclusionScopes.length === 0) {
      setError(
        serviceForm.exclusionMode === "BRANDS"
          ? "Select at least one vehicle brand to exclude."
          : "Select at least one vehicle model to exclude.",
      );
      return;
    }

    garageServiceSaveInFlight.current = true;
    setSavingGarageService(true);
    setError("");
    setSuccess("");

    try {
      await adminApi.saveGarageService(selectedGarageId, {
        serviceId: serviceForm.serviceId,
        ...(serviceForm.isExcluded
          ? { vehicleScopes: exclusionScopes }
          : {
              vehicleBrand: serviceForm.vehicleBrand,
              vehicleModel: serviceForm.vehicleModel,
            }),
        isExcluded: serviceForm.isExcluded,
        isActive: true,
      });

      setSuccess(
        serviceForm.isExcluded && exclusionScopes.length > 1
          ? `${exclusionScopes.length} vehicle exclusions saved.`
          : "Garage service saved.",
      );
      setServiceForm(createEmptyServiceForm());

      await loadGaragesAndServices();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save garage service");
    } finally {
      garageServiceSaveInFlight.current = false;
      setSavingGarageService(false);
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

  const saveGarageWideBrandExclusions = async () => {
    if (!selectedGarage?.id) return;

    setSavingGarageWideExclusions(true);
    setError("");
    setSuccess("");

    try {
      const updated = await adminApi.updateGarage(selectedGarage.id, {
        excludedServiceBrands: garageWideExcludedBrands,
      });
      setSelectedGarageDetails(updated);
      setGarages((current) =>
        current.map((garage) =>
          garage.id === updated.id ? { ...garage, ...updated } : garage,
        ),
      );
      setSuccess(
        garageWideExcludedBrands.length
          ? `${garageWideExcludedBrands.length} garage-wide brand exclusion${garageWideExcludedBrands.length === 1 ? "" : "s"} saved.`
          : "Garage-wide brand exclusions cleared.",
      );
      setEditingGarageWideExclusions(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save garage-wide brand exclusions",
      );
    } finally {
      setSavingGarageWideExclusions(false);
    }
  };

  const editGarageService = (item) => {
    const isExcluded = Boolean(item.isExcluded);
    const excludesWholeBrand =
      isExcluded && String(item.vehicleModel || "ALL").toUpperCase() === "ALL";

    setServiceForm({
      ...createEmptyServiceForm(),
      serviceId: item.serviceId,
      vehicleBrand: excludesWholeBrand ? "" : item.vehicleBrand || "ALL",
      vehicleModel: isExcluded ? "ALL" : item.vehicleModel || "ALL",
      isExcluded,
      exclusionMode: excludesWholeBrand ? "BRANDS" : "MODELS",
      excludedBrands: excludesWholeBrand ? [item.vehicleBrand] : [],
      excludedModels: isExcluded && !excludesWholeBrand ? [item.vehicleModel] : [],
    });
  };

  const openGarageDetails = async (garageId) => {
    setSelectedGarageId(garageId);
    setSelectedPhotoIds([]);
    setError("");

    try {
      const data = await adminApi.getGarage(garageId);
      setSelectedGarageDetails(data);
      setEditingGarage(false);
    } catch (err) {
      setSelectedGarageDetails(null);
      setError(err.response?.data?.message || "Unable to load garage details");
    }
  };

  const beginGarageEdit = () => {
    if (!selectedGarage) return;
    setGarageEditForm({
      name: selectedGarage.name || "", description: getCleanGarageDescription(selectedGarage.description),
      ownerName: selectedGarage.owner?.name || "", ownerEmail: selectedGarage.owner?.email || "", ownerPhone: selectedGarage.owner?.phone || "",
      phone: selectedGarage.phone || "", whatsappNo: selectedGarage.whatsappNo || "", email: selectedGarage.email || "",
      address: selectedGarage.address || "", city: selectedGarage.city || "", area: selectedGarage.area || "",
      latitude: selectedGarage.latitude ?? "", longitude: selectedGarage.longitude ?? "", workingRadiusKm: selectedGarage.workingRadiusKm || 15,
      garageType: selectedGarage.garageType || "MULTI_BRAND", fulfillmentMode: selectedGarage.fulfillmentMode || "BOTH", supportedBrands: getGarageBrands(selectedGarage).join(", "),
      openingTime: selectedGarage.openingTime || "", closingTime: selectedGarage.closingTime || "", isVerified: Boolean(selectedGarage.isVerified),
    });
    setEditingGarage(true);
  };

  const saveGarageDetails = async (event) => {
    event.preventDefault();
    setSavingGarage(true); setError(""); setSuccess("");
    try {
      const payload = { ...garageEditForm, latitude: Number(garageEditForm.latitude), longitude: Number(garageEditForm.longitude), workingRadiusKm: Number(garageEditForm.workingRadiusKm), supportedBrands: garageEditForm.supportedBrands.split(",").map((item) => item.trim()).filter(Boolean), email: garageEditForm.email || null, ownerEmail: garageEditForm.ownerEmail || null, whatsappNo: garageEditForm.whatsappNo || null, openingTime: garageEditForm.openingTime || null, closingTime: garageEditForm.closingTime || null };
      const updated = await adminApi.updateGarage(selectedGarage.id, payload);
      setSelectedGarageDetails(updated); setEditingGarage(false); setSuccess("Garage details updated successfully.");
      await loadGaragesAndServices();
    } catch (err) { setError(err.response?.data?.message || "Unable to update garage details"); }
    finally { setSavingGarage(false); }
  };

  const uploadGaragePhotos = async (event) => {
    const selectedFiles = [...(event.target.files || [])];
    event.target.value = "";
    if (!selectedFiles.length) return;

    const remainingSlots = Math.max(
      0,
      MAX_GARAGE_PHOTOS - (selectedGarage.images?.length || 0),
    );
    const supportedFiles = selectedFiles.filter((file) =>
      GARAGE_PHOTO_MIME_TYPES.has(String(file.type || "").toLowerCase()),
    );
    const unsupportedCount = selectedFiles.length - supportedFiles.length;
    const oversizedFiles = supportedFiles.filter(
      (file) => file.size > MAX_GARAGE_PHOTO_SIZE_BYTES,
    );
    const files = supportedFiles
      .filter((file) => file.size <= MAX_GARAGE_PHOTO_SIZE_BYTES)
      .slice(0, remainingSlots);
    const capacitySkippedCount = Math.max(
      0,
      supportedFiles.length - oversizedFiles.length - files.length,
    );
    const skippedMessages = [];

    if (oversizedFiles.length > 0) {
      skippedMessages.push(
        `${oversizedFiles.length} over ${MAX_GARAGE_PHOTO_SIZE_MB} MB`,
      );
    }
    if (unsupportedCount > 0) {
      skippedMessages.push(`${unsupportedCount} unsupported format`);
    }
    if (capacitySkippedCount > 0) {
      skippedMessages.push(`${capacitySkippedCount} beyond gallery capacity`);
    }

    if (!files.length) {
      setError(
        skippedMessages.length > 0
          ? `No photos uploaded. Skipped: ${skippedMessages.join(", ")}.`
          : "No gallery slots are available.",
      );
      return;
    }

    setPhotoBusyId("upload"); setError(""); setSuccess("");
    try {
      await adminApi.uploadGaragePhotos(selectedGarage.id, files);
      await openGarageDetails(selectedGarage.id);
      setSuccess(
        `${files.length} garage photo${files.length === 1 ? "" : "s"} uploaded.${skippedMessages.length > 0 ? ` Skipped: ${skippedMessages.join(", ")}.` : ""}`,
      );
    }
    catch (err) { setError(err.response?.data?.message || "Unable to upload garage photos"); }
    finally { setPhotoBusyId(""); }
  };

  const deleteGaragePhoto = async (image) => {
    if (!window.confirm("Delete this garage photo permanently?")) return;
    setPhotoBusyId(image.id); setError("");
    try { await adminApi.deleteGaragePhoto(selectedGarage.id, image.id); await openGarageDetails(selectedGarage.id); setSuccess("Garage photo deleted."); }
    catch (err) { setError(err.response?.data?.message || "Unable to delete garage photo"); }
    finally { setPhotoBusyId(""); }
  };

  const toggleGaragePhotoSelection = (imageId) => {
    setSelectedPhotoIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId],
    );
  };

  const toggleAllGaragePhotos = () => {
    setSelectedPhotoIds(allGaragePhotosSelected ? [] : allGaragePhotoIds);
  };

  const deleteSelectedGaragePhotos = async () => {
    const imageIds = selectedPhotoIds.filter((imageId) =>
      allGaragePhotoIds.includes(imageId),
    );
    if (!imageIds.length) return;

    const confirmed = window.confirm(
      `Delete ${imageIds.length} selected garage photo${imageIds.length === 1 ? "" : "s"} permanently?`,
    );
    if (!confirmed) return;

    setPhotoBusyId("bulk-delete");
    setError("");
    setSuccess("");

    try {
      await adminApi.deleteGaragePhotos(selectedGarage.id, imageIds);
      await openGarageDetails(selectedGarage.id);
      setSuccess(
        `${imageIds.length} garage photo${imageIds.length === 1 ? "" : "s"} deleted.`,
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to delete selected garage photos",
      );
    } finally {
      setPhotoBusyId("");
    }
  };

  const setGarageThumbnail = async (image) => {
    setPhotoBusyId(image.id); setError("");
    try { const updated = await adminApi.setGarageThumbnail(selectedGarage.id, image.id); setSelectedGarageDetails(updated); setSuccess("Garage thumbnail updated."); }
    catch (err) { setError(err.response?.data?.message || "Unable to update thumbnail"); }
    finally { setPhotoBusyId(""); }
  };

  const moveGaragePhoto = async (index, direction) => {
    const images = [...(selectedGarage.images || [])];
    const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= images.length) return;
    [images[index], images[nextIndex]] = [images[nextIndex], images[index]];
    setPhotoBusyId(images[nextIndex].id);
    try { const updated = await adminApi.reorderGaragePhotos(selectedGarage.id, images.map((image) => image.id)); setSelectedGarageDetails(updated); }
    catch (err) { setError(err.response?.data?.message || "Unable to reorder photos"); }
    finally { setPhotoBusyId(""); }
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

  const setGarageActiveStatus = async (garage) => {
    if (!garage || isIntern) return;

    const nextIsActive = !garage.isActive;
    const action = nextIsActive ? "enable" : "disable";

    if (
      !nextIsActive &&
      !window.confirm(
        `Disable ${garage.name}? It will be removed from customer matching and will stop receiving new booking WhatsApp alerts.`,
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");
    setStatusUpdatingGarageId(garage.id);

    try {
      await adminApi.setGarageActiveStatus(garage.id, nextIsActive);
      setSuccess(
        `${garage.name} ${nextIsActive ? "enabled" : "disabled"}. ${
          nextIsActive
            ? "It can now participate in new customer searches."
            : "It is excluded from matching and WhatsApp booking alerts."
        }`,
      );
      await loadGaragesAndServices();
    } catch (err) {
      setError(
        err.response?.data?.message || `Unable to ${action} this garage`,
      );
    } finally {
      setStatusUpdatingGarageId("");
    }
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

        <div className="flex rounded-xl border border-line bg-white p-1 shadow-sm">
          {[
            ["applications", "Applications"],
            ["services", "Garages"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
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

      {isIntern && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          Intern access is read-only. Admins and Main Admins can approve applications, delete garages, and change assigned services.
        </div>
      )}

      {tab === "applications" ? (
        <div className="space-y-4">
          <section className="card-soft rounded-xl p-4 shadow-sm">
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
                        "rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition sm:text-sm",
                        applicationStatus === status
                          ? "border-ink bg-ink text-white shadow-sm"
                          : "border-line bg-white text-muted hover:border-ink/25 hover:bg-bg-soft hover:text-ink",
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
                    <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-muted transition hover:border-ink/20 hover:bg-bg-soft">
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
                  className="card-soft rounded-xl p-4 shadow-sm"
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

                        <p className="mt-1 break-words text-sm text-muted">
                          {application.ownerName} · {application.phone}
                          {application.email
                            ? ` · ${application.email}`
                            : " · No email provided"}
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
                              className="block overflow-hidden rounded-lg border border-line bg-bg-soft"
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
                        "inline-flex w-fit shrink-0 self-start items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-bold",
                        applicationStatusMeta[application.status]?.tone ||
                          "border-line bg-bg-soft text-muted",
                      ].join(" ")}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                          applicationStatusMeta[application.status]?.dot ||
                          "bg-muted"
                        }`}
                      />
                      {applicationStatusMeta[application.status]?.label ||
                        application.status}
                    </span>
                  </div>

                  {!isIntern &&
                    application.status !== "APPROVED" &&
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
                            className={`${adminButtonBase} border border-emerald-200 bg-white text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50`}
                          >
                            <FiCheck />
                            Approve
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              runApplicationAction(application, "changes")
                            }
                            className={`${adminButtonBase} border border-line bg-white text-ink hover:border-ink/30 hover:bg-bg-soft`}
                          >
                            <FiEdit3 />
                            Changes
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              runApplicationAction(application, "deny")
                            }
                            className={`${adminButtonBase} border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50`}
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
        <div className="grid gap-4">
          <aside className="card-soft overflow-hidden rounded-xl shadow-sm">
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink transition hover:border-ink/30 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiRefreshCw className={loading ? "animate-spin" : ""} />
                </button>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-[minmax(240px,1fr)_220px_auto]">
                <CitySelect
                  value={filterCity}
                  onChange={setFilterCity}
                  includeInactive
                  placeholder="Filter garages by city"
                  className={fieldClass}
                />

                <select
                  value={filterStatus}
                  onChange={(event) => setFilterStatus(event.target.value)}
                  className={fieldClass}
                  aria-label="Filter garages by operational status"
                >
                  <option value="ALL">All garage statuses</option>
                  <option value="ACTIVE">Enabled garages</option>
                  <option value="DISABLED">Disabled garages</option>
                </select>

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
                  <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-muted transition hover:border-ink/20 hover:bg-bg-soft">
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
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiTrash2 />
                    Delete
                  </button>
                </div>
              )}
            </div>

            <div className="grid max-h-[360px] grid-cols-1 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
              {garages.length ? (
                garages.map((garage) => (
                  <div
                    key={garage.id}
                    className={[
                      "flex items-start gap-3 border-b border-line p-3 transition sm:border-r",
                      selectedGarageId === garage.id
                        ? "border-l-4 border-lime-400 bg-lime-50 text-ink"
                        : "border-l-4 border-transparent hover:bg-bg-soft",
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

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => openGarageDetails(garage.id)}
                        className="w-full min-w-0 text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-semibold">
                            {garage.name}
                          </span>
                          <FiEye className="shrink-0" />
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span>
                            {garage.city} · {garage.services?.length || 0}{" "}
                            services
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-bold ${
                              garage.isActive
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                garage.isActive
                                  ? "bg-emerald-500"
                                  : "bg-amber-500"
                              }`}
                            />
                            {garage.isActive ? "Enabled" : "Disabled"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md border border-sky-100 bg-sky-50 px-1.5 py-0.5 font-bold text-sky-700">
                            {garage.fulfillmentMode === "SELF_DROP_OFF" ? (
                              <FiMapPin />
                            ) : (
                              <FiTruck />
                            )}
                            {garage.fulfillmentMode === "PICKUP_DELIVERY"
                              ? "Pickup only"
                              : garage.fulfillmentMode === "SELF_DROP_OFF"
                                ? "Self drop-off only"
                                : "Pickup + self drop-off"}
                          </span>
                        </div>
                      </button>

                      {!isIntern && (
                        <button
                          type="button"
                          onClick={() => setGarageActiveStatus(garage)}
                          disabled={statusUpdatingGarageId === garage.id}
                          className={`mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-wait disabled:opacity-60 ${
                            garage.isActive
                              ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 focus:ring-amber-200"
                              : "border-lime-300 bg-lime-100 text-lime-900 hover:bg-lime-200 focus:ring-lime-300"
                          }`}
                        >
                          {statusUpdatingGarageId === garage.id ? (
                            <FiRefreshCw className="animate-spin" />
                          ) : garage.isActive ? (
                            <FiPauseCircle />
                          ) : (
                            <FiPlayCircle />
                          )}
                          {statusUpdatingGarageId === garage.id
                            ? "Updating..."
                            : garage.isActive
                              ? "Disable garage"
                              : "Enable garage"}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-sm text-muted">No garages found.</div>
              )}
            </div>
          </aside>

          <main className="min-w-0 space-y-4">
            <section className="card-soft rounded-xl p-4 shadow-sm">
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
                    <span className="rounded-md border border-lime-200 bg-lime-50 px-3 py-1 text-xs font-semibold text-lime-900">
                      {selectedGarage.isVerified ? "Verified" : "Unverified"}
                    </span>

                    <span
                      className={`rounded-md border px-3 py-1 text-xs font-bold ${
                        selectedGarage.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {selectedGarage.isActive ? "Enabled" : "Disabled"}
                    </span>

                    {!isIntern && (
                      <button
                        type="button"
                        onClick={() => setGarageActiveStatus(selectedGarage)}
                        disabled={statusUpdatingGarageId === selectedGarage.id}
                        className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-wait disabled:opacity-60 ${
                          selectedGarage.isActive
                            ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 focus:ring-amber-200"
                            : "border-lime-300 bg-lime-100 text-lime-900 hover:bg-lime-200 focus:ring-lime-300"
                        }`}
                      >
                        {statusUpdatingGarageId === selectedGarage.id ? (
                          <FiRefreshCw className="animate-spin" />
                        ) : selectedGarage.isActive ? (
                          <FiPauseCircle />
                        ) : (
                          <FiPlayCircle />
                        )}
                        {statusUpdatingGarageId === selectedGarage.id
                          ? "Updating..."
                          : selectedGarage.isActive
                            ? "Disable garage"
                            : "Enable garage"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {selectedGarage && !selectedGarage.isActive && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">
                  <FiPauseCircle className="mt-0.5 shrink-0 text-lg" />
                  <p>
                    This garage is paused. It is excluded from customer
                    matching, active search counts, new booking requests and
                    garage-directed WhatsApp alerts until an admin enables it.
                  </p>
                </div>
              )}

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
              <section className="card-soft space-y-4 rounded-xl p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h4 className="font-bold text-ink">Garage Details</h4>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
                    {getCleanGarageDescription(selectedGarage.description) ||
                      "No garage description submitted."}
                  </p>
                  </div>
                  {!isIntern && <button type="button" onClick={beginGarageEdit} className={`${adminButtonBase} border border-line bg-white text-ink hover:border-ink`}><FiEdit3 /> Edit all details</button>}
                </div>

                {editingGarage && garageEditForm && (
                  <form onSubmit={saveGarageDetails} className="grid gap-4 rounded-xl border border-line bg-bg-soft p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {["name", "ownerName", "ownerEmail", "ownerPhone", "phone", "whatsappNo", "email", "address", "area", "latitude", "longitude", "workingRadiusKm", "openingTime", "closingTime"].map((key) => <label key={key} className={`grid gap-1.5 text-xs font-bold uppercase tracking-wide text-muted ${key === "address" ? "sm:col-span-2" : ""}`}>{key.replace(/([A-Z])/g, " $1")}<input required={["name", "ownerName", "ownerPhone", "phone", "address", "area", "latitude", "longitude", "workingRadiusKm"].includes(key)} type={["latitude", "longitude", "workingRadiusKm"].includes(key) ? "number" : ["openingTime", "closingTime"].includes(key) ? "time" : ["email", "ownerEmail"].includes(key) ? "email" : "text"} step={["latitude", "longitude"].includes(key) ? "any" : undefined} value={garageEditForm[key]} onChange={(event) => setGarageEditForm({ ...garageEditForm, [key]: event.target.value })} className={fieldClass} /></label>)}
                    <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">City<CitySelect required value={garageEditForm.city} onChange={(city) => setGarageEditForm({ ...garageEditForm, city })} className={fieldClass} /></label>
                    <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">Garage type<select value={garageEditForm.garageType} onChange={(event) => setGarageEditForm({ ...garageEditForm, garageType: event.target.value })} className={fieldClass}><option value="MULTI_BRAND">Multi-brand</option><option value="AUTHORIZED">Authorized</option></select></label>
                    <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">Booking handover<select value={garageEditForm.fulfillmentMode} onChange={(event) => setGarageEditForm({ ...garageEditForm, fulfillmentMode: event.target.value })} className={fieldClass}><option value="BOTH">Pickup and self drop-off</option><option value="PICKUP_DELIVERY">Pickup & delivery only</option><option value="SELF_DROP_OFF">Self drop-off only</option></select></label>
                    <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wide text-muted sm:col-span-2">Supported brands (comma separated)<input value={garageEditForm.supportedBrands} onChange={(event) => setGarageEditForm({ ...garageEditForm, supportedBrands: event.target.value })} className={fieldClass} /></label>
                    <label className="flex items-center gap-2 self-end rounded-lg border border-line bg-white px-3 py-3 text-sm font-semibold text-ink"><input type="checkbox" checked={garageEditForm.isVerified} onChange={(event) => setGarageEditForm({ ...garageEditForm, isVerified: event.target.checked })} /> Verified garage</label>
                    <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wide text-muted sm:col-span-2 lg:col-span-3">Description<textarea rows={4} value={garageEditForm.description} onChange={(event) => setGarageEditForm({ ...garageEditForm, description: event.target.value })} className="rounded-lg border border-line bg-white p-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-ink" /></label>
                    <div className="rounded-lg border border-line bg-white p-3 text-xs leading-5 text-muted sm:col-span-2 lg:col-span-3">
                      Rating ({Number(selectedGarage.ratingAvg || 0).toFixed(1)} from {selectedGarage.ratingCount || 0} reviews), application ID and creation date are system-managed to preserve review and audit history.
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end lg:col-span-3"><button type="button" onClick={() => setEditingGarage(false)} className={`${adminButtonBase} border border-line bg-white text-ink`}>Cancel</button><button type="submit" disabled={savingGarage} className={`${adminButtonBase} bg-ink text-white`}>{savingGarage ? "Saving..." : "Save garage details"}</button></div>
                  </form>
                )}

                <div className="grid gap-3 text-sm text-muted sm:grid-cols-2 lg:grid-cols-3">
                  <span>
                    <strong className="text-ink">Garage type:</strong>{" "}
                    {selectedGarage.garageType === "AUTHORIZED"
                      ? "Authorized"
                      : "Multi-brand"}
                  </span>
                  <span>
                    <strong className="text-ink">Booking handover:</strong>{" "}
                    {selectedGarage.fulfillmentMode === "PICKUP_DELIVERY"
                      ? "Pickup & delivery only"
                      : selectedGarage.fulfillmentMode === "SELF_DROP_OFF"
                        ? "Self drop-off only"
                        : "Pickup and self drop-off"}
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
                  /{MAX_GARAGE_PHOTOS})
                </div>

                {!isIntern && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={`${adminButtonBase} w-fit cursor-pointer border border-line bg-white text-ink hover:border-ink`}>
                      <FiUpload />
                      {photoBusyId === "upload" ? "Uploading..." : "Add photos"}
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        multiple
                        disabled={Boolean(photoBusyId) || (selectedGarage.images?.length || 0) >= MAX_GARAGE_PHOTOS}
                        onChange={uploadGaragePhotos}
                        className="hidden"
                      />
                    </label>

                    <span className="text-xs font-medium text-muted">
                      JPEG, PNG or WebP · up to {MAX_GARAGE_PHOTO_SIZE_MB} MB each
                    </span>

                    {selectedGarage.images?.length > 0 && (
                      <>
                        <button
                          type="button"
                          disabled={Boolean(photoBusyId)}
                          onClick={toggleAllGaragePhotos}
                          className={`${adminButtonBase} border border-line bg-white text-ink hover:border-ink`}
                        >
                          <FiCheck />
                          {allGaragePhotosSelected ? "Clear selection" : "Select all"}
                        </button>
                        <button
                          type="button"
                          disabled={!selectedPhotoIds.length || Boolean(photoBusyId)}
                          onClick={deleteSelectedGaragePhotos}
                          className={`${adminButtonBase} border border-red-200 bg-white text-red-700 hover:bg-red-50`}
                        >
                          <FiTrash2 />
                          {photoBusyId === "bulk-delete"
                            ? "Deleting..."
                            : `Delete selected (${selectedPhotoIds.length})`}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {selectedGarage.images?.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
                    {selectedGarage.images.map((image, index) => (
                      <div
                        key={image.id}
                        className={`relative overflow-hidden rounded-xl border bg-white shadow-sm transition ${
                          selectedPhotoIds.includes(image.id)
                            ? "border-ink ring-2 ring-ink/10"
                            : "border-line"
                        }`}
                      >
                        {!isIntern && (
                          <label className="absolute left-2 top-2 z-10 flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white/95 px-2.5 py-2 text-xs font-semibold text-ink shadow-sm backdrop-blur">
                            <input
                              type="checkbox"
                              checked={selectedPhotoIds.includes(image.id)}
                              disabled={Boolean(photoBusyId)}
                              onChange={() => toggleGaragePhotoSelection(image.id)}
                              className="h-4 w-4 rounded border-line accent-ink"
                              aria-label={`Select garage photo ${index + 1}`}
                            />
                            Select
                          </label>
                        )}

                        <a
                          href={getGarageImageUrl(image)}
                          target="_blank"
                          rel="noreferrer"
                          className="block bg-bg-soft"
                        >
                          <img
                            src={getGarageImageUrl(image)}
                            alt={`${selectedGarage.name} garage photo ${index + 1}`}
                            className="aspect-[4/3] w-full object-cover"
                          />
                        </a>

                        <div className="flex min-h-11 items-center justify-between gap-2 border-t border-line px-3 py-2">
                          <span className="truncate text-xs font-semibold text-muted">
                            {image.isThumbnail ? "Current cover" : `Photo ${index + 1}`}
                          </span>

                          {!isIntern && (
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                title="Move photo left"
                                aria-label={`Move photo ${index + 1} left`}
                                disabled={index === 0 || Boolean(photoBusyId)}
                                onClick={() => moveGaragePhoto(index, -1)}
                                className="grid h-8 w-8 place-items-center rounded-md border border-line bg-white text-muted transition hover:border-ink/20 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <FiArrowLeft />
                              </button>
                              <button
                                type="button"
                                title="Move photo right"
                                aria-label={`Move photo ${index + 1} right`}
                                disabled={index === selectedGarage.images.length - 1 || Boolean(photoBusyId)}
                                onClick={() => moveGaragePhoto(index, 1)}
                                className="grid h-8 w-8 place-items-center rounded-md border border-line bg-white text-muted transition hover:border-ink/20 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <FiArrowRight />
                              </button>
                            </div>
                          )}
                        </div>

                        {!isIntern && (
                          <div className="grid grid-cols-2 gap-2 border-t border-line bg-bg-soft/50 p-2">
                            <button
                              type="button"
                              disabled={image.isThumbnail || Boolean(photoBusyId)}
                              onClick={() => setGarageThumbnail(image)}
                              className="inline-flex min-h-9 items-center justify-center rounded-md border border-line bg-white px-2 text-xs font-semibold text-ink transition hover:border-ink/25 hover:bg-bg-soft disabled:cursor-not-allowed disabled:text-muted"
                            >
                              {image.isThumbnail ? "Selected" : "Set cover"}
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(photoBusyId)}
                              onClick={() => deleteGaragePhoto(image)}
                              className="inline-flex min-h-9 items-center justify-center rounded-md border border-red-200 bg-white px-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-bg-soft p-4 text-sm text-muted">
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
                    <div className="rounded-md border border-line bg-bg-soft px-3 py-1.5 text-sm font-semibold text-ink">
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
                            className="rounded-xl border border-line bg-white p-4"
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

                            <p className="mt-4 whitespace-pre-wrap rounded-lg bg-bg-soft p-3 text-sm text-ink">
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
                                  label="Pickup evidence"
                                />
                                <ReviewInspectionPhotos
                                  images={inspectionImages}
                                  phase="DELIVERY"
                                  label="Delivery evidence"
                                />
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg bg-bg-soft p-4 text-sm text-muted">
                      No customer reviews have been submitted for this garage.
                    </div>
                  )}
                </div>
              </section>
            )}

            {!isIntern && selectedGarage && (
              <section className="card-soft rounded-xl p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-bold text-ink">Garage-wide brand exclusions</h4>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
                      Select brands this garage does not service at all. These exclusions override every current and future service allocation and prevent matching notifications for those vehicles.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start">
                    <span className="whitespace-nowrap rounded-full border border-line bg-bg-soft px-3 py-1 text-xs font-semibold text-muted">
                      {garageWideExcludedBrands.length} excluded
                    </span>
                    {!editingGarageWideExclusions && (
                      <button
                        type="button"
                        onClick={() => {
                          setGarageWideExcludedBrands(
                            getGarageExcludedServiceBrands(selectedGarage),
                          );
                          setEditingGarageWideExclusions(true);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink transition hover:border-ink/30 hover:bg-bg-soft"
                        aria-label="Edit garage-wide brand exclusions"
                        title="Edit brand exclusions"
                      >
                        <FiEdit3 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {editingGarageWideExclusions && (
                  <>
                <div className="mt-4 grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {vehicleBrands.map((brand) => {
                    const checked = garageWideExcludedBrands.includes(brand.name);
                    return (
                      <label
                        key={brand.id || brand.name}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                          checked
                            ? "border-ink bg-bg-soft text-ink"
                            : "border-line bg-white text-muted hover:border-ink/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setGarageWideExcludedBrands((current) =>
                              checked
                                ? current.filter((name) => name !== brand.name)
                                : [...current, brand.name],
                            )
                          }
                          className="h-4 w-4 accent-black"
                        />
                        <span className="truncate">{brand.name}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  {garageWideExcludedBrands.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setGarageWideExcludedBrands([])}
                      disabled={savingGarageWideExclusions}
                      className={`${adminButtonBase} border border-line bg-white text-ink hover:bg-bg-soft`}
                    >
                      Clear selection
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setGarageWideExcludedBrands(
                        getGarageExcludedServiceBrands(selectedGarage),
                      );
                      setEditingGarageWideExclusions(false);
                    }}
                    disabled={savingGarageWideExclusions}
                    className={`${adminButtonBase} border border-line bg-white text-ink hover:bg-bg-soft`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveGarageWideBrandExclusions}
                    disabled={savingGarageWideExclusions}
                    className={`${adminButtonBase} bg-ink text-white hover:bg-ink-2`}
                  >
                    {savingGarageWideExclusions ? "Saving..." : "Save brand exclusions"}
                  </button>
                </div>
                  </>
                )}
              </section>
            )}

            {!isIntern && (
            <form
              onSubmit={saveGarageService}
              className="card-soft grid gap-3 rounded-xl p-4 shadow-sm md:grid-cols-2 2xl:grid-cols-[minmax(180px,1fr)_minmax(210px,1.15fr)_minmax(150px,0.75fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)]"
            >
              <label className="grid min-w-0 gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                Garage
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
              </label>

              <label className="grid min-w-0 gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                Service
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
              </label>

              <label className="grid min-w-0 gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                Assignment rule
                <select
                  value={serviceForm.isExcluded ? "EXCLUDE" : "INCLUDE"}
                  onChange={(event) => {
                    const isExcluded = event.target.value === "EXCLUDE";
                    setServiceForm((current) => ({
                      ...createEmptyServiceForm(),
                      serviceId: current.serviceId,
                      isExcluded,
                      vehicleBrand: isExcluded ? "" : "ALL",
                    }));
                  }}
                  className={fieldClass}
                >
                  <option value="INCLUDE">Provide service</option>
                  <option value="EXCLUDE">Exclude vehicles</option>
                </select>
              </label>

              {serviceForm.isExcluded && (
                <label className="grid min-w-0 gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                  Exclusion scope
                  <select
                    value={serviceForm.exclusionMode}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        exclusionMode: event.target.value,
                        vehicleBrand: "",
                        excludedBrands: [],
                        excludedModels: [],
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="BRANDS">Entire brands</option>
                    <option value="MODELS">Specific models</option>
                  </select>
                </label>
              )}

              {!serviceForm.isExcluded && (
                <>
              <label className="grid min-w-0 gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                Vehicle brand
                <select
                value={serviceForm.vehicleBrand}
                onChange={(event) =>
                  setServiceForm((current) => {
                    const vehicleBrand = event.target.value;
                    return {
                      ...current,
                      vehicleBrand,
                      vehicleModel: "ALL",
                    };
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
              </label>

              <label className="grid min-w-0 gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                Vehicle model
                <select
                value={serviceForm.vehicleModel}
                onChange={(event) =>
                  setServiceForm({
                    ...serviceForm,
                    vehicleModel: event.target.value,
                  })
                }
                disabled={!serviceForm.vehicleBrand || serviceForm.vehicleBrand === "ALL"}
                className={fieldClass}
              >
                <option value="ALL">All models</option>
                {vehicleModels.map((model) => (
                  <option key={model.id || model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
                </select>
              </label>
                </>
              )}

              {serviceForm.isExcluded && serviceForm.exclusionMode === "BRANDS" && (
                <fieldset className="rounded-xl border border-line bg-white p-3 md:col-span-2 2xl:col-span-5">
                  <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted">
                    Brands to exclude
                  </legend>
                  <p className="mb-3 text-sm text-muted">
                    Select every brand that must not receive this service. All models under each selected brand will be excluded.
                  </p>
                  <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {vehicleBrands.map((brand) => {
                      const checked = serviceForm.excludedBrands.includes(brand.name);
                      return (
                        <label
                          key={brand.id || brand.name}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                            checked
                              ? "border-ink bg-bg-soft text-ink"
                              : "border-line bg-white text-muted hover:border-ink/30"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setServiceForm((current) => ({
                                ...current,
                                excludedBrands: checked
                                  ? current.excludedBrands.filter((name) => name !== brand.name)
                                  : [...current.excludedBrands, brand.name],
                              }))
                            }
                            className="h-4 w-4 accent-black"
                          />
                          <span className="truncate">{brand.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-muted">
                    {serviceForm.excludedBrands.length
                      ? `${serviceForm.excludedBrands.length} brand${serviceForm.excludedBrands.length === 1 ? "" : "s"} selected`
                      : "No brands selected"}
                  </p>
                </fieldset>
              )}

              {serviceForm.isExcluded && serviceForm.exclusionMode === "MODELS" && (
                <>
                  <label className="grid min-w-0 gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    Vehicle brand
                    <select
                      value={serviceForm.vehicleBrand}
                      onChange={(event) =>
                        setServiceForm((current) => ({
                          ...current,
                          vehicleBrand: event.target.value,
                          excludedModels: [],
                        }))
                      }
                      className={fieldClass}
                    >
                      <option value="">Select brand</option>
                      {vehicleBrands.map((brand) => (
                        <option key={brand.id || brand.name} value={brand.name}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <fieldset className="rounded-xl border border-line bg-white p-3 md:col-span-2 2xl:col-span-5">
                    <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted">
                      Models to exclude
                    </legend>
                    {!serviceForm.vehicleBrand ? (
                      <p className="text-sm text-muted">Select a brand to see its models.</p>
                    ) : vehicleModels.length ? (
                      <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {vehicleModels.map((model) => {
                          const checked = serviceForm.excludedModels.includes(model.name);
                          return (
                            <label
                              key={model.id || model.name}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                                checked
                                  ? "border-ink bg-bg-soft text-ink"
                                  : "border-line bg-white text-muted hover:border-ink/30"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setServiceForm((current) => ({
                                    ...current,
                                    excludedModels: checked
                                      ? current.excludedModels.filter((name) => name !== model.name)
                                      : [...current.excludedModels, model.name],
                                  }))
                                }
                                className="h-4 w-4 accent-black"
                              />
                              <span className="truncate">{model.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted">No models are available for this brand.</p>
                    )}
                  </fieldset>
                </>
              )}

              <button
                type="submit"
                disabled={
                  savingGarageService ||
                  !selectedGarageId ||
                  !serviceForm.serviceId ||
                  (serviceForm.isExcluded &&
                    (serviceForm.exclusionMode === "BRANDS"
                      ? serviceForm.excludedBrands.length === 0
                      : !serviceForm.vehicleBrand || serviceForm.excludedModels.length === 0))
                }
                className="inline-flex h-10 items-center justify-center rounded-lg bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2 2xl:col-span-5"
              >
                {savingGarageService ? "Saving..." : "Save"}
              </button>
            </form>
            )}

            <section className="card-soft overflow-hidden rounded-xl shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      {["Service", "Category", "Rule", "Vehicle Scope", "Actions"].map(
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

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                                item.isExcluded
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-green-200 bg-green-50 text-green-700"
                              }`}
                            >
                              {item.isExcluded ? "Excluded" : "Provided"}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-muted">
                            {formatGarageServiceScope(item)}
                          </td>

                          <td className="px-4 py-3">
                            {isIntern ? (
                              <span className="text-xs font-semibold text-muted">Read only</span>
                            ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => editGarageService(item)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink transition hover:border-ink/30 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
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
                            )}
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
