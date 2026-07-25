import { useEffect, useState } from "react";
import { adminApi } from "@/api/admin";
import { formatRupeeRange } from "@/utils/priceRange";
import { cityApi } from "@/api/cities";
import { useApp } from "@/hooks/useApp";
import CitySelect from "@/components/common/CitySelect";
import { resetCityAvailabilityCache } from "@/utils/cityAvailability";
import {
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiLock,
  FiPlus,
  FiPercent,
  FiRefreshCw,
  FiTrash2,
  FiUser,
  FiX,
  FiXCircle,
} from "react-icons/fi";

const fuelTypes = [
  "",
  "PETROL",
  "DIESEL",
  "ELECTRIC",
  "HYBRID",
  "CNG",
  "OTHER",
];

const emptyForm = {
  id: "",
  city: "",
  serviceId: "",
  vehicleBrand: "",
  vehicleModel: "",
  fuelType: "",
  minPrice: "",
  maxPrice: "",
  isActive: true,
};

const emptySubmissionEditForm = {
  city: "",
  serviceId: "",
  vehicleBrand: "",
  vehicleModel: "",
  fuelType: "",
  minPrice: "",
  maxPrice: "",
  isActive: true,
};

const getRangeScopeKey = (range = {}) =>
  [
    String(range.city || "").trim().toLowerCase(),
    range.serviceId || "",
    String(range.vehicleBrand || "").trim().toLowerCase(),
    String(range.vehicleModel || "").trim().toLowerCase(),
    range.fuelType || "",
  ].join("|");

const formatServiceLabel = (service = {}) =>
  [service.category?.name, service.name].filter(Boolean).join(" - ") ||
  service.id ||
  "Unknown service";

const submissionFilters = [
  "ALL",
  "PENDING",
  "EDITED",
  "APPROVED",
  "REJECTED",
];

const submissionStatusStyles = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  EDITED: "border-blue-200 bg-blue-50 text-blue-800",
  APPROVED: "border-green-200 bg-green-50 text-green-800",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
};

const formatSubmittedAt = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function SubmissionStatusBadge({ status }) {
  const normalizedStatus = status || "PENDING";
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
        submissionStatusStyles[normalizedStatus] ||
          submissionStatusStyles.PENDING,
      ].join(" ")}
    >
      {normalizedStatus === "PENDING" ? (
        <FiClock />
      ) : normalizedStatus === "EDITED" ? (
        <FiEdit3 />
      ) : normalizedStatus === "APPROVED" ? (
        <FiCheck />
      ) : (
        <FiX />
      )}
      {normalizedStatus.charAt(0) + normalizedStatus.slice(1).toLowerCase()}
    </span>
  );
}

export default function Revenue() {
  const { user } = useApp();
  const isIntern = user?.role === "INTERN";
  const [ranges, setRanges] = useState([]);
  const [totalRangeCount, setTotalRangeCount] = useState(0);
  const [nextRangeCursor, setNextRangeCursor] = useState(null);
  const [loadingMoreRanges, setLoadingMoreRanges] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [services, setServices] = useState([]);
  const [cities, setCities] = useState([]);
  const [vehicleBrands, setVehicleBrands] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [cityForm, setCityForm] = useState({ name: "", state: "" });
  const [filterCity, setFilterCity] = useState("");
  const [filterVehicleBrand, setFilterVehicleBrand] = useState("");
  const [filterVehicleModel, setFilterVehicleModel] = useState("");
  const [filterFuelType, setFilterFuelType] = useState("");
  const [submissionFilter, setSubmissionFilter] = useState(
    isIntern ? "ALL" : "PENDING",
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState("");
  const [approvingAll, setApprovingAll] = useState(false);
  const [editSubmissionTarget, setEditSubmissionTarget] = useState(null);
  const [submissionEditForm, setSubmissionEditForm] = useState(
    emptySubmissionEditForm,
  );
  const [editingSubmissionId, setEditingSubmissionId] = useState("");
  const [submissionEditError, setSubmissionEditError] = useState("");
  const [deletingSubmissionId, setDeletingSubmissionId] = useState("");
  const [deletingAllSubmissions, setDeletingAllSubmissions] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [citySaving, setCitySaving] = useState(false);
  const [citySelectKey, setCitySelectKey] = useState(0);
  const [selectedRangeIds, setSelectedRangeIds] = useState([]);
  const [deletingRanges, setDeletingRanges] = useState(false);
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState(null);
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState("");
  const [bulkDeletePassword, setBulkDeletePassword] = useState("");
  const [bulkDeleteError, setBulkDeleteError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cityDiscounts, setCityDiscounts] = useState([]);
  const [discountForm, setDiscountForm] = useState({
    cityId: "",
    discountPercent: "5",
    isActive: true,
  });
  const [savingDiscount, setSavingDiscount] = useState(false);

  const loadCities = async () => {
    try {
      const data = await cityApi.getAdminCities({ includeInactive: true });
      setCities(Array.isArray(data) ? data : []);
    } catch {
      setCities([]);
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const priceRangeFilters = {
        ...(filterCity.trim() && { city: filterCity.trim() }),
        ...(filterVehicleBrand && { vehicleBrand: filterVehicleBrand }),
        ...(filterVehicleModel && { vehicleModel: filterVehicleModel }),
        ...(filterFuelType && { fuelType: filterFuelType }),
      };
      const [rangeList, serviceList, submissionList, discountList] =
        await Promise.all([
          adminApi.getPriceRanges({ ...priceRangeFilters, limit: 100 }),
          adminApi.getAssignableServices(),
          adminApi.getPriceRangeSubmissions(),
          adminApi.getCityPriceDiscounts(),
        ]);

      const loadedRanges = Array.isArray(rangeList?.items)
        ? rangeList.items
        : [];
      const total = Number(rangeList?.total);

      setRanges(loadedRanges);
      setTotalRangeCount(
        Number.isFinite(total) ? Math.max(0, total) : loadedRanges.length,
      );
      setNextRangeCursor(rangeList?.nextCursor || null);
      setServices(serviceList || []);
      setSubmissions(submissionList || []);
      setCityDiscounts(Array.isArray(discountList) ? discountList : []);
      setSelectedRangeIds([]);
    } catch (err) {
      setRanges([]);
      setTotalRangeCount(0);
      setNextRangeCursor(null);
      setError(err.response?.data?.message || "Unable to load price ranges");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreRanges = async () => {
    if (!nextRangeCursor || loadingMoreRanges) return;
    try {
      setLoadingMoreRanges(true);
      const result = await adminApi.getPriceRanges({
        ...(filterCity.trim() && { city: filterCity.trim() }),
        ...(filterVehicleBrand && { vehicleBrand: filterVehicleBrand }),
        ...(filterVehicleModel && { vehicleModel: filterVehicleModel }),
        ...(filterFuelType && { fuelType: filterFuelType }),
        limit: 100,
        cursor: nextRangeCursor,
      });
      setRanges((current) => [...current, ...(result?.items || [])]);
      const total = Number(result?.total);
      if (Number.isFinite(total)) {
        setTotalRangeCount(Math.max(0, total));
      }
      setNextRangeCursor(result?.nextCursor || null);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load more price ranges");
    } finally {
      setLoadingMoreRanges(false);
    }
  };

  useEffect(() => {
    adminApi
      .getCarBrands()
      .then((brands) => setVehicleBrands(Array.isArray(brands) ? brands : []))
      .catch(() => setVehicleBrands([]));
    loadCities();
  }, []);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (isIntern) setSubmissionFilter("ALL");
  }, [isIntern]);

  const updateForm = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "vehicleBrand" && { vehicleModel: "" }),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    if (isIntern && form.id) {
      setError("Interns can add new price ranges but cannot edit existing ranges.");
      setSaving(false);
      return;
    }

    const minPrice = Number(form.minPrice);
    const maxPrice = Number(form.maxPrice);

    if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) {
      setError("Enter valid min and max prices.");
      setSaving(false);
      return;
    }

    if (minPrice > maxPrice) {
      setError("Min price cannot be greater than max price.");
      setSaving(false);
      return;
    }

    if (!form.vehicleBrand.trim()) {
      setError("Select a vehicle brand. Brand is required for service visibility.");
      setSaving(false);
      return;
    }

    const payload = {
      city: form.city.trim(),
      serviceId: form.serviceId,
      vehicleBrand: form.vehicleBrand.trim(),
      vehicleModel: form.vehicleModel.trim() || null,
      fuelType: form.fuelType || null,
      minPrice,
      maxPrice,
      isActive: form.isActive,
    };

    try {
      if (form.id) {
        await adminApi.updatePriceRange(form.id, payload);
        setSuccess("Price range updated.");
      } else {
        await adminApi.createPriceRange(payload);
        setSuccess(
          isIntern
            ? "Price range submitted for admin approval. Customers cannot see it yet."
            : "Price range created and published.",
        );
      }

      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save price range");
    } finally {
      setSaving(false);
    }
  };

  const selectDiscountCity = (cityId) => {
    const existing = cityDiscounts.find((item) => item.cityId === cityId);
    setDiscountForm({
      cityId,
      discountPercent: String(existing?.discountPercent || 5),
      isActive: existing ? Boolean(existing.isActive) : true,
    });
  };

  const saveCityDiscount = async (event) => {
    event.preventDefault();
    if (isIntern) return;

    const discountPercent = Number(discountForm.discountPercent);
    if (!discountForm.cityId) {
      setError("Select a city for the price display rule.");
      return;
    }
    if (
      !Number.isInteger(discountPercent) ||
      discountPercent < 1 ||
      discountPercent > 90
    ) {
      setError("Comparison increase must be between 1 and 90%.");
      return;
    }

    setSavingDiscount(true);
    setError("");
    setSuccess("");
    try {
      const saved = await adminApi.saveCityPriceDiscount({
        cityId: discountForm.cityId,
        discountPercent,
        isActive: discountForm.isActive,
      });
      setCityDiscounts((current) => {
        const withoutSaved = current.filter(
          (item) => item.cityId !== saved.cityId,
        );
        return [...withoutSaved, saved].sort((a, b) =>
          String(a.city?.name || "").localeCompare(String(b.city?.name || "")),
        );
      });
      setSuccess(
        `${saved.city?.name || "City"} price display rule ${
          saved.isActive ? "activated" : "disabled"
        }.`,
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to save city price display rule",
      );
    } finally {
      setSavingDiscount(false);
    }
  };

  const addCity = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCitySaving(true);

    try {
      const city = await cityApi.createCity(cityForm);
      resetCityAvailabilityCache();
      setCityForm({ name: "", state: "" });
      setForm((current) => ({
        ...current,
        city: city?.name || current.city,
      }));
      setFilterCity(city?.name || filterCity);
      setSuccess("City added. You can now create price ranges for it.");
      await loadCities();
      setCitySelectKey((key) => key + 1);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to add city");
    } finally {
      setCitySaving(false);
    }
  };

  const toggleCity = async (city) => {
    setError("");
    setSuccess("");

    try {
      await cityApi.updateCity(city.id, { isActive: !city.isActive });
      resetCityAvailabilityCache();
      await loadCities();
      setCitySelectKey((key) => key + 1);
      setSuccess(`${city.name} ${city.isActive ? "disabled" : "enabled"}.`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update city");
    }
  };

  const editRange = (range) => {
    setForm({
      id: range.id,
      city: range.city || "",
      serviceId: range.serviceId || "",
      vehicleBrand: range.vehicleBrand || "ALL",
      vehicleModel: range.vehicleModel || "",
      fuelType: range.fuelType || "",
      minPrice: range.minPrice ?? "",
      maxPrice: range.maxPrice ?? "",
      isActive: Boolean(range.isActive),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteRange = async (range) => {
    const ok = window.confirm("Delete this price range?");
    if (!ok) return;

    setError("");
    setSuccess("");

    try {
      await adminApi.deletePriceRange(range.id);
      setSuccess("Price range deleted.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete price range");
    }
  };

  const reviewSubmission = async (
    submission,
    decision,
    reason = "",
  ) => {
    if (
      isIntern ||
      approvingAll ||
      !["PENDING", "EDITED"].includes(submission.status)
    ) {
      return;
    }

    setReviewingId(submission.id);
    setError("");
    setSuccess("");

    try {
      await adminApi.reviewPriceRangeSubmission(submission.id, {
        decision,
        ...(decision === "REJECTED" && {
          rejectionReason: reason.trim() || undefined,
        }),
      });
      setRejectTarget(null);
      setRejectionReason("");
      setSuccess(
        decision === "APPROVED"
          ? "Submission approved and published to customers."
          : "Submission rejected. It was not added to live customer pricing.",
      );
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to review submission");
    } finally {
      setReviewingId("");
    }
  };

  const submitRejection = async (event) => {
    event.preventDefault();
    if (!rejectTarget) return;
    await reviewSubmission(rejectTarget, "REJECTED", rejectionReason);
  };

  const approveAllSubmissions = async () => {
    if (
      isIntern ||
      approvingAll ||
      reviewingId ||
      editingSubmissionId ||
      deletingSubmissionId
    ) {
      return;
    }

    const reviewableCount =
      submissionCounts.PENDING + submissionCounts.EDITED;
    if (!reviewableCount) return;

    const confirmed = window.confirm(
      `Approve and publish all ${reviewableCount} pending or edited price range submissions?`,
    );
    if (!confirmed) return;

    setApprovingAll(true);
    setError("");
    setSuccess("");

    try {
      const result = await adminApi.approveAllPriceRangeSubmissions();
      const approvedCount = result.approved || 0;
      const supersededCount = result.superseded || 0;
      setSuccess(
        `${approvedCount} price range submission${approvedCount === 1 ? "" : "s"} approved and published.${
          supersededCount
            ? ` ${supersededCount} older duplicate${supersededCount === 1 ? " was" : "s were"} marked as superseded.`
            : ""
        }`,
      );
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to approve all submissions");
    } finally {
      setApprovingAll(false);
    }
  };

  const openSubmissionEditor = (submission) => {
    if (
      isIntern ||
      approvingAll ||
      !["PENDING", "EDITED"].includes(submission.status)
    ) {
      return;
    }

    setEditSubmissionTarget(submission);
    setSubmissionEditForm({
      city: submission.city || "",
      serviceId: submission.serviceId || submission.service?.id || "",
      vehicleBrand: submission.vehicleBrand || "ALL",
      vehicleModel: submission.vehicleModel || "",
      fuelType: submission.fuelType || "",
      minPrice: submission.minPrice ?? "",
      maxPrice: submission.maxPrice ?? "",
      isActive: Boolean(submission.isActive),
    });
    setSubmissionEditError("");
  };

  const closeSubmissionEditor = () => {
    if (editingSubmissionId) return;
    setEditSubmissionTarget(null);
    setSubmissionEditForm(emptySubmissionEditForm);
    setSubmissionEditError("");
  };

  const updateSubmissionEditForm = (key, value) => {
    setSubmissionEditForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "vehicleBrand" && { vehicleModel: "" }),
    }));
    setSubmissionEditError("");
  };

  const saveSubmissionEdit = async (event) => {
    event.preventDefault();
    if (!editSubmissionTarget) return;

    const minPrice = Number(submissionEditForm.minPrice);
    const maxPrice = Number(submissionEditForm.maxPrice);
    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
      setSubmissionEditError("Enter valid minimum and maximum prices.");
      return;
    }
    if (minPrice > maxPrice) {
      setSubmissionEditError("Minimum price cannot exceed maximum price.");
      return;
    }

    setEditingSubmissionId(editSubmissionTarget.id);
    setSubmissionEditError("");
    setError("");
    setSuccess("");

    try {
      const updated = await adminApi.editPriceRangeSubmission(
        editSubmissionTarget.id,
        {
          city: submissionEditForm.city.trim(),
          serviceId: submissionEditForm.serviceId,
          vehicleBrand: submissionEditForm.vehicleBrand.trim(),
          vehicleModel: submissionEditForm.vehicleModel.trim() || null,
          fuelType: submissionEditForm.fuelType || null,
          minPrice,
          maxPrice,
          isActive: submissionEditForm.isActive,
        },
      );
      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === updated.id ? updated : submission,
        ),
      );
      setEditSubmissionTarget(null);
      setSubmissionEditForm(emptySubmissionEditForm);
      setSubmissionFilter("EDITED");
      setSuccess("Submission edited. Review the changes, then approve or reject it.");
    } catch (err) {
      setSubmissionEditError(
        err.response?.data?.message || "Unable to edit submission",
      );
    } finally {
      setEditingSubmissionId("");
    }
  };

  const deleteSubmissionHistory = async (submission) => {
    if (isIntern) return;

    const message =
      submission.status === "APPROVED"
        ? "Delete this submission history? Its approved live price range will remain available."
        : ["PENDING", "EDITED"].includes(submission.status)
          ? "Delete this submission awaiting review? It will no longer be available for approval."
          : "Delete this rejected submission history?";
    if (!window.confirm(message)) return;

    setDeletingSubmissionId(submission.id);
    setError("");
    setSuccess("");

    try {
      await adminApi.deletePriceRangeSubmission(submission.id);
      setSubmissions((current) =>
        current.filter((item) => item.id !== submission.id),
      );
      setSuccess("Submission history deleted.");
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to delete submission history",
      );
    } finally {
      setDeletingSubmissionId("");
    }
  };

  const deleteAllSubmissionHistory = async () => {
    if (
      isIntern ||
      deletingAllSubmissions ||
      reviewingId ||
      approvingAll ||
      editingSubmissionId ||
      deletingSubmissionId ||
      visibleSubmissions.length === 0
    ) {
      return;
    }

    const filterLabel =
      submissionFilter === "ALL"
        ? "all"
        : submissionFilter.toLowerCase();
    const approvedNote = ["ALL", "APPROVED"].includes(submissionFilter)
      ? " Approved live customer price ranges will remain available."
      : "";
    const confirmed = window.confirm(
      `Delete all ${filterLabel} price range submission records? This cannot be undone.${approvedNote}`,
    );
    if (!confirmed) return;

    setDeletingAllSubmissions(true);
    setError("");
    setSuccess("");

    try {
      const result = await adminApi.deletePriceRangeSubmissions(
        submissionFilter === "ALL" ? null : submissionFilter,
      );
      const deletedCount = result.deleted || 0;
      setSuccess(
        `${deletedCount} ${filterLabel} submission record${deletedCount === 1 ? "" : "s"} deleted.${
          ["ALL", "APPROVED"].includes(submissionFilter)
            ? " Approved live price ranges were not deleted."
            : ""
        }`,
      );
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to delete submission records",
      );
    } finally {
      setDeletingAllSubmissions(false);
    }
  };

  const visibleRangeIds = ranges.map((range) => range.id);
  const allVisibleRangesSelected =
    visibleRangeIds.length > 0 &&
    visibleRangeIds.every((rangeId) => selectedRangeIds.includes(rangeId));

  const toggleRangeSelection = (rangeId) => {
    setSelectedRangeIds((current) =>
      current.includes(rangeId)
        ? current.filter((id) => id !== rangeId)
        : [...current, rangeId],
    );
  };

  const toggleAllVisibleRanges = () => {
    setSelectedRangeIds(allVisibleRangesSelected ? [] : visibleRangeIds);
  };

  const deleteSelectedRanges = () => {
    const rangeIds = selectedRangeIds.filter((rangeId) =>
      visibleRangeIds.includes(rangeId),
    );
    if (!rangeIds.length) return;

    setBulkDeleteTarget({ mode: "selected", rangeIds });
    setBulkDeleteConfirmation("");
    setBulkDeletePassword("");
    setBulkDeleteError("");
  };

  const deleteAllRanges = () => {
    if (!ranges.length) return;

    setBulkDeleteTarget({ mode: "all", rangeIds: [] });
    setBulkDeleteConfirmation("");
    setBulkDeletePassword("");
    setBulkDeleteError("");
  };

  const closeBulkDeleteDialog = () => {
    if (deletingRanges) return;
    setBulkDeleteTarget(null);
    setBulkDeleteConfirmation("");
    setBulkDeletePassword("");
    setBulkDeleteError("");
  };

  const confirmBulkDelete = async (event) => {
    event.preventDefault();
    if (!bulkDeleteTarget) return;

    const deleteAll = bulkDeleteTarget.mode === "all";
    const rangeIds = deleteAll ? [] : bulkDeleteTarget.rangeIds;
    const expectedConfirmation = deleteAll
      ? "DELETE ALL PRICE RANGES"
      : "DELETE SELECTED";
    if (
      bulkDeleteConfirmation !== expectedConfirmation ||
      !bulkDeletePassword
    ) {
      return;
    }

    setDeletingRanges(true);
    setError("");
    setSuccess("");
    setBulkDeleteError("");

    try {
      const result = await adminApi.deletePriceRanges(
        rangeIds,
        deleteAll,
        bulkDeleteConfirmation,
        bulkDeletePassword,
      );
      if (deleteAll || rangeIds.includes(form.id)) setForm(emptyForm);
      const deletedCount = result.deleted || 0;
      setSuccess(
        deleteAll
          ? `${deletedCount} price range${deletedCount === 1 ? "" : "s"} deleted across all cities.`
          : `${deletedCount || rangeIds.length} price range${(deletedCount || rangeIds.length) === 1 ? "" : "s"} deleted.`,
      );
      setBulkDeleteTarget(null);
      setBulkDeleteConfirmation("");
      setBulkDeletePassword("");
      await load();
    } catch (err) {
      setBulkDeletePassword("");
      setBulkDeleteError(
        err.response?.data?.message || "Unable to verify the admin password",
      );
    } finally {
      setDeletingRanges(false);
    }
  };

  const selectedVehicleBrand = vehicleBrands.find(
    (brand) => brand.name === form.vehicleBrand
  );

  const vehicleModels = selectedVehicleBrand?.models || [];
  const selectedFilterVehicleBrand = vehicleBrands.find(
    (brand) => brand.name === filterVehicleBrand,
  );
  const filterVehicleModels = selectedFilterVehicleBrand?.models || [];
  const submissionEditBrand = vehicleBrands.find(
    (brand) => brand.name === submissionEditForm.vehicleBrand,
  );
  const submissionEditModels = submissionEditBrand?.models || [];

  const duplicateScopeKeys = ranges.reduce((counts, range) => {
    const key = getRangeScopeKey(range);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const submissionCounts = submissions.reduce(
    (counts, submission) => ({
      ...counts,
      [submission.status]: (counts[submission.status] || 0) + 1,
    }),
    { PENDING: 0, EDITED: 0, APPROVED: 0, REJECTED: 0 },
  );

  const visibleSubmissions = submissions.filter(
    (submission) =>
      submissionFilter === "ALL" || submission.status === submissionFilter,
  );
  const bulkDeleteExpectedText =
    bulkDeleteTarget?.mode === "all"
      ? "DELETE ALL PRICE RANGES"
      : "DELETE SELECTED";
  const bulkDeleteCount =
    bulkDeleteTarget?.mode === "all"
      ? ranges.length
      : bulkDeleteTarget?.rangeIds?.length || 0;
  const canConfirmBulkDelete =
    bulkDeleteConfirmation === bulkDeleteExpectedText &&
    bulkDeletePassword.length > 0 &&
    !deletingRanges;
  const discountPreviewPercent = Math.min(
    90,
    Math.max(1, Number(discountForm.discountPercent) || 5),
  );
  const discountPreviewMin = Math.round(
    1000 * (1 + discountPreviewPercent / 100),
  );
  const discountPreviewMax = Math.round(
    2000 * (1 + discountPreviewPercent / 100),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4 overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink">
            Price Ranges
          </h2>
          <p className="mt-1 text-sm text-muted">
            Manage live pricing and review intern-submitted estimates.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="hidden h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiXCircle className="shrink-0" />
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
          New price ranges are sent to an admin for approval. You can track
          pending, edited, approved, and rejected submissions below; only
          approved entries become visible to customers.
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 border-b border-line px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-bg-soft text-ink">
              <FiPercent />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-extrabold text-ink">
                City display pricing
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                Add a crossed comparison range to service cards for a city. The saved price range remains the only amount used for booking and checkout.
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">
            <FiLock className="text-xs" />
            Checkout unchanged
          </span>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <form
            onSubmit={saveCityDiscount}
            className="p-4 sm:p-6 lg:border-r lg:border-line"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-ink">
                City
                <select
                  value={discountForm.cityId}
                  onChange={(event) => selectDiscountCity(event.target.value)}
                  className="h-12 rounded-xl border border-line bg-white px-3.5 outline-none transition focus:border-ink focus:ring-4 focus:ring-gray-100"
                >
                  <option value="">Select city</option>
                  {cities
                    .filter((city) => city.isActive)
                    .map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-ink">
                Comparison increase
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    step="1"
                    value={discountForm.discountPercent}
                    onChange={(event) =>
                      setDiscountForm((current) => ({
                        ...current,
                        discountPercent: event.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-xl border border-line bg-white px-3.5 pr-10 outline-none transition focus:border-ink focus:ring-4 focus:ring-gray-100"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-extrabold text-muted">
                    %
                  </span>
                </div>
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-line bg-bg-soft/55 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  role="switch"
                  aria-checked={discountForm.isActive}
                  onClick={() =>
                    setDiscountForm((current) => ({
                      ...current,
                      isActive: !current.isActive,
                    }))
                  }
                  className="flex min-w-0 items-center gap-3 text-left"
                >
                  <span
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
                      discountForm.isActive ? "bg-ink" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                        discountForm.isActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold text-ink">
                      {discountForm.isActive ? "Visible to customers" : "Hidden from customers"}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted">
                      The comparison range appears without extra labels on customer service cards.
                    </span>
                  </span>
                </button>

                <button
                  type="submit"
                  disabled={isIntern || savingDiscount}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-extrabold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiCheck />
                  {savingDiscount ? "Saving..." : "Save display rule"}
                </button>
              </div>
            </div>
          </form>

          <aside className="bg-bg-soft/55 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-muted">
                  Customer preview
                </p>
                <p className="mt-1 text-xs text-muted">
                  Product-style service card
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                  discountForm.isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {discountForm.isActive ? "Visible" : "Hidden"}
              </span>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white shadow-sm">
              <div className="relative h-40 overflow-hidden bg-gradient-to-br from-gray-950 via-gray-800 to-gray-700 p-4 text-white">
                <div className="absolute -right-7 -top-8 h-28 w-28 rounded-full bg-[#b9f000]/20 blur-2xl" />
                <div className="relative z-10 flex h-full flex-col">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#b9f000]">
                    Rovauto service
                  </p>
                  <p className="mt-2 max-w-[220px] text-lg font-black leading-tight">
                    High Performance AC Service
                  </p>
                  <span className="mt-auto inline-flex w-fit items-center border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/90">
                    Verified service
                  </span>
                </div>
              </div>

              <div className="p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-muted">
                  Estimated price range
                </p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="text-2xl font-black tracking-tight text-ink">
                    {formatRupeeRange(1000, 2000)}
                  </span>
                  {discountForm.isActive && (
                    <span className="text-sm font-semibold text-red-500 line-through decoration-[1.5px] decoration-red-500">
                      {formatRupeeRange(discountPreviewMin, discountPreviewMax)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">
                  The first amount is always used for booking and checkout.
                </p>
                <div className="mt-4 h-10 rounded-lg bg-[#b9f000] text-center text-sm font-black leading-10 text-gray-950">
                  Book service
                </div>
              </div>
            </div>
          </aside>
        </div>

        {cityDiscounts.length > 0 && (
          <div className="border-t border-line px-4 py-5 sm:px-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-ink">
                  Configured cities
                </h4>
                <p className="mt-0.5 text-xs text-muted">
                  Select a city row to edit its display rule.
                </p>
              </div>
              <span className="rounded-full bg-bg-soft px-2.5 py-1 text-xs font-bold text-muted">
                {cityDiscounts.length} rule{cityDiscounts.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-line">
              {cityDiscounts.map((discount, index) => (
                <button
                  key={discount.id}
                  type="button"
                  onClick={() => selectDiscountCity(discount.cityId)}
                  className={`flex w-full items-center justify-between gap-4 bg-white px-4 py-3.5 text-left transition hover:bg-bg-soft/60 ${
                    index === cityDiscounts.length - 1 ? "" : "border-b border-line"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        discount.isActive ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-ink">
                        {discount.city?.name || "Unknown city"}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {discount.isActive ? "Visible on service cards" : "Rule disabled"}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-black text-ink">
                    +{discount.discountPercent}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card-soft overflow-hidden rounded-2xl shadow-sm">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-bg-soft text-ink">
                  <FiClock />
                </span>
                <div>
                  <h3 className="font-bold text-ink">
                    {isIntern
                      ? "My Price Range Submissions"
                      : "Intern Price Range Review"}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted sm:text-sm">
                    {isIntern
                      ? "Track the admin decision for every range you submit."
                      : "Approve a submission to publish it, or reject it to keep it out of live pricing."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:min-w-[440px] sm:grid-cols-4">
              {[
                ["Pending", submissionCounts.PENDING, "text-amber-700"],
                ["Edited", submissionCounts.EDITED, "text-blue-700"],
                ["Approved", submissionCounts.APPROVED, "text-green-700"],
                ["Rejected", submissionCounts.REJECTED, "text-red-700"],
              ].map(([label, count, color]) => (
                <div
                  key={label}
                  className="rounded-xl border border-line bg-white px-3 py-2 text-center"
                >
                  <div className={`text-lg font-bold ${color}`}>{count}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {submissionFilters.map((filter) => {
              const count =
                filter === "ALL"
                  ? submissions.length
                  : submissionCounts[filter] || 0;
              const active = submissionFilter === filter;

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSubmissionFilter(filter)}
                  disabled={deletingAllSubmissions}
                  className={[
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition",
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-muted hover:border-ink hover:text-ink",
                  ].join(" ")}
                >
                  {filter.charAt(0) + filter.slice(1).toLowerCase()}
                  <span
                    className={[
                      "rounded-full px-1.5 py-0.5 text-[10px]",
                      active ? "bg-white/15 text-white" : "bg-bg-soft text-muted",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {!isIntern &&
              (visibleSubmissions.length > 0 ||
                submissionCounts.PENDING + submissionCounts.EDITED > 0) && (
              <div className="ml-auto flex shrink-0 gap-2">
                {submissionCounts.PENDING + submissionCounts.EDITED > 0 && (
                  <button
                    type="button"
                    onClick={approveAllSubmissions}
                    disabled={
                      approvingAll ||
                      Boolean(reviewingId) ||
                      Boolean(editingSubmissionId) ||
                      Boolean(deletingSubmissionId) ||
                      deletingAllSubmissions
                    }
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-green-700 px-3 text-xs font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiCheckCircle className={approvingAll ? "animate-pulse" : ""} />
                    {approvingAll
                      ? "Approving all..."
                      : `Approve all (${submissionCounts.PENDING + submissionCounts.EDITED})`}
                  </button>
                )}
                {visibleSubmissions.length > 0 && (
                  <button
                    type="button"
                    onClick={deleteAllSubmissionHistory}
                    disabled={
                      deletingAllSubmissions ||
                      approvingAll ||
                      Boolean(reviewingId) ||
                      Boolean(editingSubmissionId) ||
                      Boolean(deletingSubmissionId)
                    }
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiTrash2 />
                    {deletingAllSubmissions
                      ? "Deleting..."
                      : `Delete all (${visibleSubmissions.length})`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {loading && submissions.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted">
              <FiRefreshCw className="animate-spin" />
              Loading submissions...
            </div>
          ) : visibleSubmissions.length ? (
            <div
              className={[
                "grid gap-3",
                visibleSubmissions.length > 2
                  ? "max-h-[680px] overflow-y-auto overscroll-contain pr-1 sm:max-h-[590px]"
                  : "",
              ].join(" ")}
              aria-label="Price range submissions"
            >
              {visibleSubmissions.map((submission) => (
                <article
                  key={submission.id}
                  className="rounded-xl border border-line bg-white p-4 transition hover:border-gray-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate font-bold text-ink">
                        {formatServiceLabel(submission.service)}
                      </h4>
                      <p className="mt-1 text-xs text-muted">
                        Submitted {formatSubmittedAt(submission.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <SubmissionStatusBadge status={submission.status} />
                      {!isIntern && (
                        <button
                          type="button"
                          onClick={() => deleteSubmissionHistory(submission)}
                          disabled={
                            deletingAllSubmissions ||
                            approvingAll ||
                            deletingSubmissionId === submission.id ||
                            reviewingId === submission.id ||
                            editingSubmissionId === submission.id
                          }
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Delete submission history"
                          title="Delete submission history"
                        >
                          <FiTrash2 />
                          <span className="hidden sm:inline">
                            {deletingSubmissionId === submission.id
                              ? "Deleting..."
                              : "Delete"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                        City
                      </div>
                      <div className="mt-1 font-semibold capitalize text-ink">
                        {submission.city}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                        Price range
                      </div>
                      <div className="mt-1 font-semibold text-ink">
                        {formatRupeeRange(
                          submission.minPrice,
                          submission.maxPrice,
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                        Vehicle
                      </div>
                      <div className="mt-1 text-ink">
                        {submission.vehicleBrand || "All brands"} /{" "}
                        {submission.vehicleModel || "All models"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                        Fuel
                      </div>
                      <div className="mt-1 text-ink">
                        {submission.fuelType || "Any fuel"}
                      </div>
                    </div>
                  </div>

                  {!isIntern && submission.submittedBy && (
                    <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
                      <FiUser />
                      <span>
                        Submitted by{" "}
                        <strong className="text-ink">
                          {submission.submittedBy.name ||
                            submission.submittedBy.loginId}
                        </strong>
                      </span>
                    </div>
                  )}

                  {submission.status === "REJECTED" &&
                    submission.rejectionReason && (
                      <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                        <strong>Reason:</strong> {submission.rejectionReason}
                      </div>
                    )}

                  {!isIntern &&
                    ["PENDING", "EDITED"].includes(submission.status) && (
                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => openSubmissionEditor(submission)}
                        disabled={
                          deletingAllSubmissions ||
                          approvingAll ||
                          reviewingId === submission.id ||
                          editingSubmissionId === submission.id
                        }
                        className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1"
                      >
                        <FiEdit3 />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          reviewSubmission(submission, "APPROVED")
                        }
                        disabled={
                          deletingAllSubmissions ||
                          approvingAll ||
                          reviewingId === submission.id ||
                          editingSubmissionId === submission.id
                        }
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiCheck />
                        {reviewingId === submission.id
                          ? "Reviewing..."
                          : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectTarget(submission);
                          setRejectionReason("");
                        }}
                        disabled={
                          deletingAllSubmissions ||
                          approvingAll ||
                          reviewingId === submission.id ||
                          editingSubmissionId === submission.id
                        }
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiX />
                        Reject
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-bg-soft/50 px-4 text-center">
              <FiClock className="text-xl text-muted" />
              <p className="mt-2 text-sm font-semibold text-ink">
                No {submissionFilter.toLowerCase()} submissions
              </p>
              <p className="mt-1 text-xs text-muted">
                {isIntern
                  ? "Your submitted price ranges and their decisions will appear here."
                  : "New intern price ranges will appear here for review."}
              </p>
            </div>
          )}
        </div>
      </section>

      <form
        onSubmit={submit}
        className="card-soft rounded-2xl p-4 shadow-sm"
      >
        <div>
          <h3 className="font-bold text-ink">
            {isIntern ? "Submit a Price Range" : "Create a Live Price Range"}
          </h3>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            {isIntern
              ? "Your submission stays private until an admin approves it."
              : "Admin-created ranges are published immediately."}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CitySelect
            key={`form-city-${citySelectKey}`}
            required
            value={form.city}
            onChange={(city) => updateForm("city", city)}
            placeholder="City"
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          />

          <select
            required
            value={form.serviceId}
            onChange={(e) => updateForm("serviceId", e.target.value)}
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          >
            <option value="">Select service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.category?.name ? `${service.category.name} - ` : ""}
                {service.name}
              </option>
            ))}
          </select>

          <select
            required
            value={form.vehicleBrand}
            onChange={(e) => updateForm("vehicleBrand", e.target.value)}
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          >
            <option value="">Select brand</option>
            <option value="ALL">All brands</option>
            {vehicleBrands.map((brand) => (
              <option key={brand.id || brand.name} value={brand.name}>
                {brand.name}
              </option>
            ))}
          </select>

          <select
            value={form.vehicleModel}
            onChange={(e) => updateForm("vehicleModel", e.target.value)}
            disabled={!form.vehicleBrand || form.vehicleBrand === "ALL"}
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink disabled:bg-bg-soft"
          >
            <option value="">All models</option>
            {vehicleModels.map((model) => (
              <option key={model.id || model.name} value={model.name}>
                {model.name}
              </option>
            ))}
          </select>

          <select
            value={form.fuelType}
            onChange={(e) => updateForm("fuelType", e.target.value)}
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          >
            {fuelTypes.map((fuelType) => (
              <option key={fuelType || "any"} value={fuelType}>
                {fuelType || "Any fuel"}
              </option>
            ))}
          </select>

          <input
            required
            type="number"
            min="0"
            value={form.minPrice}
            onChange={(e) => updateForm("minPrice", e.target.value)}
            placeholder="Min price"
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          />

          <input
            required
            type="number"
            min="0"
            value={form.maxPrice}
            onChange={(e) => updateForm("maxPrice", e.target.value)}
            placeholder="Max price"
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          />

          <div className="flex min-w-0 gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 text-sm font-bold text-black transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPlus />
              {saving
                ? "Saving..."
                : form.id
                  ? "Update"
                  : isIntern
                    ? "Submit for review"
                    : "Create"}
            </button>

            {form.id && (
              <button
                type="button"
                onClick={() => setForm(emptyForm)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-ink">Service Cities</h3>
            <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
              {cities.length ? (
                cities.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => !isIntern && toggleCity(city)}
                    disabled={isIntern}
                    title={isIntern ? "Intern access is read-only" : "Click to toggle city status"}
                    className={[
                      "rounded-lg border px-3 py-1 text-xs font-semibold transition",
                      city.isActive
                        ? "border-lime-200 bg-lime-100 text-ink hover:bg-lime-200"
                        : "border-line bg-bg-soft text-muted hover:text-ink",
                    ].join(" ")}
                  >
                    {city.name}
                    {city.state ? `, ${city.state}` : ""}
                    {!city.isActive ? " - inactive" : ""}
                  </button>
                ))
              ) : (
                <span className="text-sm text-muted">No cities added yet.</span>
              )}
            </div>
          </div>

          {!isIntern && (
          <form
            onSubmit={addCity}
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px]"
          >
            <input
              required
              value={cityForm.name}
              onChange={(e) =>
                setCityForm({ ...cityForm, name: e.target.value })
              }
              placeholder="City name"
              className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
            />

            <input
              value={cityForm.state}
              onChange={(e) =>
                setCityForm({ ...cityForm, state: e.target.value })
              }
              placeholder="State"
              className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
            />

            <button
              type="submit"
              disabled={citySaving}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-lime-400 px-3 text-sm font-bold text-black transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPlus />
              {citySaving ? "..." : "Add"}
            </button>
          </form>
          )}
        </div>
      </section>

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            load();
          }}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
        >
          <CitySelect
            key={`filter-city-${citySelectKey}`}
            value={filterCity}
            onChange={setFilterCity}
            placeholder="Filter by city"
            includeInactive
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          />

          <select
            value={filterVehicleBrand}
            onChange={(event) => {
              setFilterVehicleBrand(event.target.value);
              setFilterVehicleModel("");
            }}
            className="h-10 min-w-0 rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-ink"
            aria-label="Filter price ranges by vehicle brand"
          >
            <option value="">All brands</option>
            {vehicleBrands.map((brand) => (
              <option key={brand.id || brand.name} value={brand.name}>
                {brand.name}
              </option>
            ))}
          </select>

          <select
            value={filterVehicleModel}
            onChange={(event) => setFilterVehicleModel(event.target.value)}
            disabled={!filterVehicleBrand}
            className="h-10 min-w-0 rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-ink disabled:cursor-not-allowed disabled:bg-bg-soft disabled:text-muted"
            aria-label="Filter price ranges by vehicle model"
          >
            <option value="">All models</option>
            {filterVehicleModels.map((model) => (
              <option key={model.id || model.name} value={model.name}>
                {model.name}
              </option>
            ))}
          </select>

          <select
            value={filterFuelType}
            onChange={(event) => setFilterFuelType(event.target.value)}
            className="h-10 min-w-0 rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-ink"
            aria-label="Filter price ranges by fuel type"
          >
            <option value="">All fuel types</option>
            {fuelTypes.filter(Boolean).map((fuelType) => (
              <option key={fuelType} value={fuelType}>
                {fuelType}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Search
          </button>
        </form>
      </section>

      <section className="card-soft overflow-hidden rounded-2xl shadow-sm">
        <div className="flex flex-col gap-3 border-b border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-ink">
              Approved Live Price Ranges
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-bg-soft px-2.5 py-1 font-bold text-ink">
                Total price ranges: {totalRangeCount}
              </span>
              <span className="text-muted">
                Showing {ranges.length} of {totalRangeCount}
                {selectedRangeIds.length
                  ? ` · ${selectedRangeIds.length} selected`
                  : ""}
              </span>
            </div>
          </div>

          {!isIntern && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAllVisibleRanges}
                disabled={!ranges.length || loading || deletingRanges}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                {allVisibleRangesSelected ? "Clear selection" : "Select all shown"}
              </button>
              <button
                type="button"
                onClick={deleteSelectedRanges}
                disabled={!selectedRangeIds.length || loading || deletingRanges}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiTrash2 />
                Delete selected ({selectedRangeIds.length})
              </button>
              <button
                type="button"
                onClick={deleteAllRanges}
                disabled={!ranges.length || loading || deletingRanges}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-red-700 px-3 text-xs font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiTrash2 />
                {deletingRanges ? "Deleting..." : "Delete all cities"}
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="w-12 px-4 py-3">
                  {!isIntern && (
                    <input
                      type="checkbox"
                      checked={allVisibleRangesSelected}
                      disabled={!ranges.length || loading || deletingRanges}
                      onChange={toggleAllVisibleRanges}
                      className="h-4 w-4 rounded border-line accent-ink"
                      aria-label="Select all shown price ranges"
                    />
                  )}
                </th>
                {[
                  "City",
                  "Service",
                  "Vehicle",
                  "Fuel",
                  "Range",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="whitespace-nowrap px-4 py-3 font-bold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-6 text-sm text-muted">
                    Loading price ranges...
                  </td>
                </tr>
              ) : ranges.length ? (
                ranges.map((range) => {
                  const isDuplicate =
                    duplicateScopeKeys[getRangeScopeKey(range)] > 1;

                  return (
                    <tr
                      key={range.id}
                      className={`border-t border-line transition hover:bg-bg-soft/70 ${
                        selectedRangeIds.includes(range.id) ? "bg-bg-soft/80" : ""
                      }`}
                    >
                      <td className="w-12 px-4 py-3">
                        {!isIntern && (
                          <input
                            type="checkbox"
                            checked={selectedRangeIds.includes(range.id)}
                            disabled={deletingRanges}
                            onChange={() => toggleRangeSelection(range.id)}
                            className="h-4 w-4 rounded border-line accent-ink"
                            aria-label={`Select price range for ${range.city}`}
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                        {range.city}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">
                          {formatServiceLabel(range.service)}
                        </div>

                        {isDuplicate && (
                          <div className="mt-1 text-xs font-semibold text-red-600">
                            Duplicate scope
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-muted">
                        {range.vehicleBrand
                          ? `${range.vehicleBrand} / ${range.vehicleModel || "All models"}`
                          : "All brands / All models"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {range.fuelType || "Any"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-semibold">
                        {formatRupeeRange(range.minPrice, range.maxPrice)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-xs font-bold",
                            range.isActive
                              ? "bg-lime-100 text-ink"
                              : "bg-bg-soft text-muted",
                          ].join(" ")}
                        >
                          {range.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {!isIntern ? (
                          <>
                          <button
                            type="button"
                            onClick={() => editRange(range)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                            aria-label="Edit price range"
                          >
                            <FiEdit3 />
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteRange(range)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700 transition hover:bg-red-100"
                            aria-label="Delete price range"
                          >
                            <FiTrash2 />
                          </button>
                          </>
                          ) : (
                            <span className="text-xs font-semibold text-muted">
                              Admin and Main Admin edit/delete
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="px-4 py-6 text-sm text-muted">
                    No price ranges found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {nextRangeCursor && (
          <div className="border-t border-line bg-white p-4 text-center">
            <button
              type="button"
              onClick={() => void loadMoreRanges()}
              disabled={loadingMoreRanges}
              className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink disabled:opacity-50"
            >
              {loadingMoreRanges ? "Loading..." : "Load more price ranges"}
            </button>
          </div>
        )}
      </section>

      {editSubmissionTarget && (
        <div
          className="fixed inset-0 z-[105] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSubmissionEditor();
          }}
        >
          <form
            onSubmit={saveSubmissionEdit}
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-price-submission-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
                  <FiEdit3 />
                </span>
                <div>
                  <h3
                    id="edit-price-submission-title"
                    className="text-lg font-bold text-ink"
                  >
                    Edit intern submission
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    Save your corrections first. The submission will move to
                    Edited and still require a separate approval.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeSubmissionEditor}
                disabled={Boolean(editingSubmissionId)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:border-ink hover:text-ink disabled:opacity-50"
                aria-label="Close submission editor"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">
                  City
                </span>
                <CitySelect
                  required
                  includeInactive
                  value={submissionEditForm.city}
                  onChange={(value) =>
                    updateSubmissionEditForm("city", value)
                  }
                  className="mt-2 h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm outline-none transition focus:border-ink"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">
                  Service
                </span>
                <select
                  required
                  value={submissionEditForm.serviceId}
                  onChange={(event) =>
                    updateSubmissionEditForm("serviceId", event.target.value)
                  }
                  className="mt-2 h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm outline-none transition focus:border-ink"
                >
                  <option value="">Select service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {formatServiceLabel(service)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">
                  Vehicle brand
                </span>
                <select
                  required
                  value={submissionEditForm.vehicleBrand}
                  onChange={(event) =>
                    updateSubmissionEditForm(
                      "vehicleBrand",
                      event.target.value,
                    )
                  }
                  className="mt-2 h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm outline-none transition focus:border-ink"
                >
                  <option value="">Select brand</option>
                  <option value="ALL">All brands</option>
                  {vehicleBrands.map((brand) => (
                    <option key={brand.id || brand.name} value={brand.name}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">
                  Vehicle model
                </span>
                <select
                  value={submissionEditForm.vehicleModel}
                  onChange={(event) =>
                    updateSubmissionEditForm("vehicleModel", event.target.value)
                  }
                  disabled={!submissionEditForm.vehicleBrand || submissionEditForm.vehicleBrand === "ALL"}
                  className="mt-2 h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm outline-none transition focus:border-ink disabled:bg-bg-soft"
                >
                  <option value="">All models</option>
                  {submissionEditModels.map((model) => (
                    <option key={model.id || model.name} value={model.name}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">
                  Fuel type
                </span>
                <select
                  value={submissionEditForm.fuelType}
                  onChange={(event) =>
                    updateSubmissionEditForm("fuelType", event.target.value)
                  }
                  className="mt-2 h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm outline-none transition focus:border-ink"
                >
                  {fuelTypes.map((fuelType) => (
                    <option key={fuelType || "any"} value={fuelType}>
                      {fuelType || "Any fuel"}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted">
                    Minimum
                  </span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={submissionEditForm.minPrice}
                    onChange={(event) =>
                      updateSubmissionEditForm("minPrice", event.target.value)
                    }
                    className="mt-2 h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm outline-none transition focus:border-ink"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted">
                    Maximum
                  </span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={submissionEditForm.maxPrice}
                    onChange={(event) =>
                      updateSubmissionEditForm("maxPrice", event.target.value)
                    }
                    className="mt-2 h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm outline-none transition focus:border-ink"
                  />
                </label>
              </div>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-bg-soft p-3">
              <input
                type="checkbox"
                checked={submissionEditForm.isActive}
                onChange={(event) =>
                  updateSubmissionEditForm("isActive", event.target.checked)
                }
                className="mt-0.5 h-4 w-4 rounded border-line accent-ink"
              />
              <span>
                <span className="block text-sm font-bold text-ink">
                  Publish as active after approval
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Saving this edit does not publish it yet.
                </span>
              </span>
            </label>

            {submissionEditError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {submissionEditError}
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={closeSubmissionEditor}
                disabled={Boolean(editingSubmissionId)}
                className="h-11 rounded-xl border border-line text-sm font-bold text-ink transition hover:border-ink hover:bg-bg-soft disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(editingSubmissionId)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editingSubmissionId ? (
                  <FiRefreshCw className="animate-spin" />
                ) : (
                  <FiEdit3 />
                )}
                {editingSubmissionId ? "Saving..." : "Save as edited"}
              </button>
            </div>
          </form>
        </div>
      )}

      {bulkDeleteTarget && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeBulkDeleteDialog();
          }}
        >
          <form
            onSubmit={confirmBulkDelete}
            className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-price-range-delete-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700">
                  <FiLock />
                </span>
                <div>
                  <h3
                    id="bulk-price-range-delete-title"
                    className="text-lg font-bold text-ink"
                  >
                    Confirm permanent deletion
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    {bulkDeleteTarget.mode === "all"
                      ? `This will delete all ${bulkDeleteCount} live price ranges across every city.`
                      : `This will delete ${bulkDeleteCount} selected price range${bulkDeleteCount === 1 ? "" : "s"}.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeBulkDeleteDialog}
                disabled={deletingRanges}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:border-ink hover:text-ink disabled:opacity-50"
                aria-label="Close deletion confirmation"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              This action cannot be undone. Confirmation and the signed-in
              administrator&apos;s password are both required.
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">
                Confirmation text
              </span>
              <input
                value={bulkDeleteConfirmation}
                onChange={(event) => {
                  setBulkDeleteConfirmation(event.target.value);
                  setBulkDeleteError("");
                }}
                className="mt-2 h-11 w-full rounded-xl border border-line px-3 font-mono text-sm text-ink outline-none transition focus:border-ink"
                placeholder={bulkDeleteExpectedText}
                autoComplete="off"
                autoFocus
              />
              <span className="mt-1.5 block text-xs text-muted">
                Type{" "}
                <strong className="font-mono text-ink">
                  {bulkDeleteExpectedText}
                </strong>{" "}
                exactly.
              </span>
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">
                Admin password
              </span>
              <input
                type="password"
                value={bulkDeletePassword}
                onChange={(event) => {
                  setBulkDeletePassword(event.target.value);
                  setBulkDeleteError("");
                }}
                className="mt-2 h-11 w-full rounded-xl border border-line px-3 text-sm text-ink outline-none transition focus:border-ink"
                placeholder="Re-enter your admin password"
                autoComplete="current-password"
              />
            </label>

            {bulkDeleteError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {bulkDeleteError}
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={closeBulkDeleteDialog}
                disabled={deletingRanges}
                className="h-11 rounded-xl border border-line text-sm font-bold text-ink transition hover:border-ink hover:bg-bg-soft disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canConfirmBulkDelete}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-3 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
              >
                {deletingRanges ? (
                  <FiRefreshCw className="animate-spin" />
                ) : (
                  <FiTrash2 />
                )}
                {deletingRanges ? "Verifying..." : "Verify and delete"}
              </button>
            </div>
          </form>
        </div>
      )}

      {rejectTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reviewingId) {
              setRejectTarget(null);
              setRejectionReason("");
            }
          }}
        >
          <form
            onSubmit={submitRejection}
            className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-price-range-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="reject-price-range-title"
                  className="text-lg font-bold text-ink"
                >
                  Reject submission
                </h3>
                <p className="mt-1 text-sm text-muted">
                  This range will not be published. The intern will see the
                  rejected status and your reason.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectionReason("");
                }}
                disabled={Boolean(reviewingId)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:border-ink hover:text-ink disabled:opacity-50"
                aria-label="Close rejection dialog"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-bg-soft p-3 text-sm">
              <div className="font-semibold text-ink">
                {formatServiceLabel(rejectTarget.service)}
              </div>
              <div className="mt-1 text-xs text-muted">
                {rejectTarget.city} · {rejectTarget.vehicleBrand || "All brands"} ·{" "}
                {formatRupeeRange(
                  rejectTarget.minPrice,
                  rejectTarget.maxPrice,
                )}
              </div>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">
                Reason (optional)
              </span>
              <textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Explain what should be corrected before resubmitting."
                className="mt-2 w-full resize-none rounded-xl border border-line px-3 py-2 text-sm text-ink outline-none transition focus:border-ink"
              />
              <span className="mt-1 block text-right text-[11px] text-muted">
                {rejectionReason.length}/500
              </span>
            </label>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectionReason("");
                }}
                disabled={Boolean(reviewingId)}
                className="h-10 rounded-lg border border-line text-sm font-bold text-ink transition hover:border-ink hover:bg-bg-soft disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(reviewingId)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiX />
                {reviewingId ? "Rejecting..." : "Reject submission"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
