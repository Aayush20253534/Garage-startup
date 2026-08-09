import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import { cityApi } from "@/api/cities";
import { useApp } from "@/hooks/useApp";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import {
  FiAlertCircle,
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiEdit3,
  FiImage,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiStar,
  FiTrash2,
  FiTruck,
  FiX,
} from "react-icons/fi";

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const MAX_POPULAR_SERVICES = 6;

const emptyCategoryForm = {
  id: "",
  name: "",
  description: "",
  isActive: true,
  isComingSoon: false,
  restrictedCityIds: [],
  thumbnail: null,
};

const emptyServiceForm = {
  id: "",
  categoryId: "",
  name: "",
  description: "",
  isActive: true,
  isComingSoon: false,
  fulfillmentType: "BOTH",
  restrictedCityIds: [],
  thumbnail: null,
};

const fieldClass =
  "h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition placeholder:text-muted focus:border-ink";

const textareaClass =
  "min-w-0 resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none transition placeholder:text-muted focus:border-ink";

const fileClass =
  "flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium text-ink transition hover:bg-bg-soft";

const getThumbnail = (service) =>
  service?.media?.find((item) => item.isThumbnail)?.url ||
  service?.media?.[0]?.url ||
  "";

const validateThumbnail = (file, label) => {
  if (!file) return "";

  if (!file.type.startsWith("image/")) {
    return `${label} must be an image file.`;
  }

  if (file.size > MAX_THUMBNAIL_BYTES) {
    return `${label} must be under 5 MB.`;
  }

  return "";
};

const toBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true";

const isServiceComingSoon = (service) =>
  toBoolean(service?.isComingSoon);

const isCategoryComingSoon = (category) =>
  toBoolean(category?.isComingSoon);

const getRestrictedCityIds = (record) =>
  (record?.cityRestrictions || [])
    .map((restriction) => restriction.cityId || restriction.city?.id)
    .filter(Boolean);

const getRestrictedCityNames = (record) =>
  (record?.cityRestrictions || [])
    .map((restriction) => restriction.city?.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

const getCoverageItems = (description) =>
  String(description || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function RestrictedCityPicker({
  description,
  cities,
  selectedCityIds,
  search,
  onSearchChange,
  onToggle,
  onClear,
}) {
  const filteredCities = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return cities;

    return cities.filter((city) =>
      [city.name, city.state]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [cities, search]);

  return (
    <div className="rounded-xl border border-line bg-bg-soft/60 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <FiMapPin />
            Restricted cities
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-muted">
              {selectedCityIds.length}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
        </div>

        {selectedCityIds.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-bold text-red-700 hover:underline"
          >
            Clear restrictions
          </button>
        )}
      </div>

      <div className="mt-3">
        <label className="relative block">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search cities"
            className="h-9 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-ink"
          />
        </label>

        <div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
          {filteredCities.map((city) => {
            const selected = selectedCityIds.includes(city.id);
            const inactive = !toBoolean(city.isActive);

            return (
              <button
                key={city.id}
                type="button"
                disabled={inactive && !selected}
                onClick={() => onToggle(city.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-line bg-white text-ink hover:border-ink"
                }`}
                title={inactive ? "Inactive city" : undefined}
              >
                {selected && <FiX />}
                {city.name}
                {inactive && " (inactive)"}
              </button>
            );
          })}

          {filteredCities.length === 0 && (
            <span className="py-2 text-xs text-muted">No cities found.</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminServices() {
  const { user } = useApp();
  const isIntern = user?.role === "INTERN";
  const [categories, setCategories] = useState([]);
  const [catalogueCategories, setCatalogueCategories] = useState([]);
  const [popularServiceIds, setPopularServiceIds] = useState([]);
  const [popularServiceDraft, setPopularServiceDraft] = useState([]);
  const [popularServiceToAdd, setPopularServiceToAdd] = useState("");
  const [savingPopular, setSavingPopular] = useState(false);
  const [cities, setCities] = useState([]);
  const [categoryCitySearch, setCategoryCitySearch] = useState("");
  const [serviceCitySearch, setServiceCitySearch] = useState("");
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [togglingServiceId, setTogglingServiceId] = useState(null);
  const [togglingCategoryId, setTogglingCategoryId] = useState(null);
  const [coverageService, setCoverageService] = useState(null);
  const [savingCoverage, setSavingCoverage] = useState(false);
  const [reorderingCategoryId, setReorderingCategoryId] = useState(null);

  const activeCategoryCount = useMemo(
    () => categories.filter((category) => category.isActive).length,
    [categories]
  );

  const activeServiceCount = useMemo(
    () =>
      categories.reduce(
        (sum, category) =>
          sum +
          (category.services || []).filter((service) => service.isActive)
            .length,
        0
      ),
    [categories]
  );

  const catalogueServices = useMemo(
    () =>
      catalogueCategories.flatMap((category) =>
        (category.services || []).map((service) => ({
          ...service,
          categoryName: category.name,
          categoryActive: toBoolean(category.isActive),
        })),
      ),
    [catalogueCategories],
  );

  const catalogueServiceById = useMemo(
    () => new Map(catalogueServices.map((service) => [service.id, service])),
    [catalogueServices],
  );

  const selectedPopularServices = useMemo(
    () =>
      popularServiceDraft
        .map((serviceId) => catalogueServiceById.get(serviceId))
        .filter(Boolean),
    [catalogueServiceById, popularServiceDraft],
  );

  const availablePopularServices = useMemo(
    () =>
      catalogueServices
        .filter(
          (service) =>
            toBoolean(service.isActive) &&
            service.categoryActive &&
            !popularServiceDraft.includes(service.id),
        )
        .sort(
          (left, right) =>
            left.categoryName.localeCompare(right.categoryName) ||
            left.name.localeCompare(right.name),
        ),
    [catalogueServices, popularServiceDraft],
  );

  const popularSelectionChanged = useMemo(
    () =>
      popularServiceDraft.length !== popularServiceIds.length ||
      popularServiceDraft.some(
        (serviceId, index) => serviceId !== popularServiceIds[index],
      ),
    [popularServiceDraft, popularServiceIds],
  );

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const [data, catalogueData, cityData] = await Promise.all([
        adminApi.getServiceCategories({
          includeInactive,
          ...(search.trim() && { search: search.trim() }),
        }),
        adminApi.getServiceCategories({ includeInactive: true }),
        cityApi.getAdminCities({ includeInactive: true }),
      ]);

      const fullCatalogue = catalogueData || [];
      const configuredPopularIds = fullCatalogue
        .flatMap((category) => category.services || [])
        .filter((service) => toBoolean(service.isPopular))
        .sort(
          (left, right) =>
            (Number(left.popularOrder) || Number.MAX_SAFE_INTEGER) -
              (Number(right.popularOrder) || Number.MAX_SAFE_INTEGER) ||
            left.name.localeCompare(right.name),
        )
        .map((service) => service.id);

      setCategories(data || []);
      setCatalogueCategories(fullCatalogue);
      setPopularServiceIds(configuredPopularIds);
      setPopularServiceDraft(configuredPopularIds);
      setPopularServiceToAdd("");
      setCities(cityData || []);
      setServiceForm((current) => ({
        ...current,
        categoryId: current.categoryId || data?.[0]?.id || "",
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveCategory = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!categoryForm.name.trim()) {
      setError("Enter a category name.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || null,
        isActive: categoryForm.isActive,
        isComingSoon: categoryForm.isComingSoon,
        restrictedCityIds: categoryForm.restrictedCityIds,
      };

      let saved;

      if (categoryForm.id) {
        saved = await adminApi.updateServiceCategory(categoryForm.id, payload);
        setSuccess("Service category updated.");
      } else {
        saved = await adminApi.createServiceCategory(payload);
        setSuccess("Service category created.");
      }

      if (categoryForm.thumbnail) {
        const formData = new FormData();
        formData.append("thumbnail", categoryForm.thumbnail);
        await adminApi.uploadServiceCategoryThumbnail(saved.id, formData);
      }

      setCategoryForm(emptyCategoryForm);
      setCategoryCitySearch("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save category");
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (category) => {
    setCategoryForm({
      id: category.id,
      name: category.name || "",
      description: category.description || "",
      isActive: Boolean(category.isActive),
      isComingSoon: isCategoryComingSoon(category),
      restrictedCityIds: getRestrictedCityIds(category),
      thumbnail: null,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleCategoryComingSoon = async (category) => {
    const currentlyComingSoon = isCategoryComingSoon(category);

    setError("");
    setSuccess("");
    setTogglingCategoryId(category.id);

    try {
      await adminApi.updateServiceCategory(category.id, {
        isComingSoon: !currentlyComingSoon,
      });

      setSuccess(
        currentlyComingSoon
          ? `${category.name} category is now available.`
          : `${category.name} category marked as coming soon.`,
      );

      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update category availability",
      );
    } finally {
      setTogglingCategoryId(null);
    }
  };

  const toggleCategoryActive = async (category) => {
    const currentlyActive = toBoolean(category.isActive);
    const action = currentlyActive ? "deactivate" : "reactivate";

    const ok = window.confirm(
      currentlyActive
        ? `Deactivate ${category.name} and hide all of its services from customers?`
        : `Reactivate ${category.name}? Its services will remain inactive until you reactivate them individually.`,
    );

    if (!ok) return;

    setError("");
    setSuccess("");

    try {
      if (currentlyActive) {
        await adminApi.deleteServiceCategory(category.id);
      } else {
        await adminApi.updateServiceCategory(category.id, {
          isActive: true,
        });
      }

      setSuccess(
        currentlyActive
          ? "Service category deactivated."
          : "Service category reactivated.",
      );

      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          `Unable to ${action} category`,
      );
    }
  };

  const toggleCategoryRestrictedCity = (cityId) => {
    setCategoryForm((current) => {
      const selected = current.restrictedCityIds.includes(cityId);

      return {
        ...current,
        restrictedCityIds: selected
          ? current.restrictedCityIds.filter((id) => id !== cityId)
          : [...current.restrictedCityIds, cityId],
      };
    });
  };

  const setCategoryThumbnail = (file) => {
    setError("");

    if (!file) {
      setCategoryForm((current) => ({ ...current, thumbnail: null }));
      return;
    }

    const message = validateThumbnail(file, "Category thumbnail");

    if (message) {
      setError(message);
      return;
    }

    setCategoryForm((current) => ({ ...current, thumbnail: file }));
  };

  const setThumbnail = (file) => {
    setError("");

    if (!file) {
      setServiceForm((current) => ({ ...current, thumbnail: null }));
      return;
    }

    const message = validateThumbnail(file, "Service thumbnail");

    if (message) {
      setError(message);
      return;
    }

    setServiceForm((current) => ({ ...current, thumbnail: file }));
  };

  const uploadThumbnailIfNeeded = async (serviceId) => {
    if (!serviceForm.thumbnail) return;

    const formData = new FormData();
    formData.append("thumbnail", serviceForm.thumbnail);
    await adminApi.uploadServiceThumbnail(serviceId, formData);
  };

  const toggleServiceRestrictedCity = (cityId) => {
    setServiceForm((current) => {
      const selected = current.restrictedCityIds.includes(cityId);

      return {
        ...current,
        restrictedCityIds: selected
          ? current.restrictedCityIds.filter((id) => id !== cityId)
          : [...current.restrictedCityIds, cityId],
      };
    });
  };

  const saveService = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!serviceForm.categoryId || !serviceForm.name.trim()) {
      setError("Select a category and enter a service name.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        categoryId: serviceForm.categoryId,
        name: serviceForm.name.trim(),
        description: serviceForm.description.trim() || null,
        isActive: serviceForm.isActive,
        isComingSoon: serviceForm.isComingSoon,
        fulfillmentType: serviceForm.fulfillmentType,
        restrictedCityIds: serviceForm.restrictedCityIds,
      };

      let saved;

      if (serviceForm.id) {
        saved = await adminApi.updateService(serviceForm.id, payload);
        setSuccess("Service updated.");
      } else {
        saved = await adminApi.createService(payload);
        setSuccess("Service created.");
      }

      await uploadThumbnailIfNeeded(saved.id);

      setServiceForm({
        ...emptyServiceForm,
        categoryId: serviceForm.categoryId,
      });
      setServiceCitySearch("");

      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save service");
    } finally {
      setSaving(false);
    }
  };

  const editService = (service) => {
    setServiceForm({
      id: service.id,
      categoryId: service.categoryId || service.category?.id || "",
      name: service.name || "",
      description: service.description || "",
      isActive: Boolean(service.isActive),
      isComingSoon: isServiceComingSoon(service),
      fulfillmentType:
        service.fulfillmentType === "SELF_DROP_OFF"
          ? "SELF_DROP_OFF"
          : "BOTH",
      restrictedCityIds: getRestrictedCityIds(service),
      thumbnail: null,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openCoverageEditor = (service) => {
    setCoverageService({
      id: service.id,
      name: service.name,
      coverage: getCoverageItems(service.description).join("\n"),
    });
  };

  const closeCoverageEditor = () => {
    if (savingCoverage) return;
    setCoverageService(null);
  };

  const saveCoverage = async (event) => {
    event.preventDefault();
    if (!coverageService || savingCoverage) return;

    const coverageItems = coverageService.coverage
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    setSavingCoverage(true);
    setError("");
    setSuccess("");

    try {
      await adminApi.updateService(coverageService.id, {
        description: coverageItems.join(", ") || null,
      });
      const serviceName = coverageService.name;
      setCoverageService(null);
      setSuccess(`${serviceName} coverage updated.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update service coverage");
    } finally {
      setSavingCoverage(false);
    }
  };

  const toggleComingSoon = async (service) => {
    const currentlyComingSoon = isServiceComingSoon(service);

    setError("");
    setSuccess("");
    setTogglingServiceId(service.id);

    try {
      await adminApi.updateService(service.id, {
        isComingSoon: !currentlyComingSoon,
      });

      setSuccess(
        currentlyComingSoon
          ? `${service.name} is now available for booking.`
          : `${service.name} marked as coming soon.`,
      );

      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update service availability",
      );
    } finally {
      setTogglingServiceId(null);
    }
  };

  const toggleServiceActive = async (service) => {
    const currentlyActive = toBoolean(service.isActive);
    const action = currentlyActive ? "deactivate" : "reactivate";

    const ok = window.confirm(
      currentlyActive
        ? `Deactivate ${service.name} and hide it from customer selection?`
        : `Reactivate ${service.name}?`,
    );

    if (!ok) return;

    setError("");
    setSuccess("");

    try {
      if (currentlyActive) {
        await adminApi.deleteService(service.id);
      } else {
        await adminApi.updateService(service.id, {
          isActive: true,
        });
      }

      setSuccess(
        currentlyActive
          ? "Service deactivated."
          : "Service reactivated.",
      );

      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          `Unable to ${action} service`,
      );
    }
  };

  const moveCategoryService = async (category, serviceId, direction) => {
    if (isIntern || reorderingCategoryId) return;

    const orderedServices = [...(category.services || [])];
    const currentIndex = orderedServices.findIndex(
      (service) => service.id === serviceId,
    );
    const nextIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= orderedServices.length
    ) {
      return;
    }

    [orderedServices[currentIndex], orderedServices[nextIndex]] = [
      orderedServices[nextIndex],
      orderedServices[currentIndex],
    ];

    setError("");
    setSuccess("");
    setReorderingCategoryId(category.id);

    // Update the visible list immediately, then let the server persist the
    // complete category order so concurrent catalogue changes cannot be lost.
    setCategories((current) =>
      current.map((item) =>
        item.id === category.id
          ? { ...item, services: orderedServices }
          : item,
      ),
    );

    try {
      await adminApi.reorderCategoryServices(
        category.id,
        orderedServices.map((service) => service.id),
      );
      setSuccess(`Service order updated for ${category.name}.`);
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update service order",
      );
      await load();
    } finally {
      setReorderingCategoryId(null);
    }
  };

  const addPopularService = () => {
    if (!popularServiceToAdd) return;

    if (popularServiceDraft.length >= MAX_POPULAR_SERVICES) {
      setError(`You can select at most ${MAX_POPULAR_SERVICES} popular services.`);
      return;
    }

    setError("");
    setPopularServiceDraft((current) => [...current, popularServiceToAdd]);
    setPopularServiceToAdd("");
  };

  const removePopularService = (serviceId) => {
    setPopularServiceDraft((current) =>
      current.filter((currentId) => currentId !== serviceId),
    );
  };

  const movePopularService = (serviceId, direction) => {
    setPopularServiceDraft((current) => {
      const currentIndex = current.indexOf(serviceId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[currentIndex], next[nextIndex]] = [
        next[nextIndex],
        next[currentIndex],
      ];
      return next;
    });
  };

  const savePopularServices = async () => {
    if (savingPopular || !popularSelectionChanged) return;

    setSavingPopular(true);
    setError("");
    setSuccess("");

    try {
      await adminApi.updatePopularServices(popularServiceDraft);
      setSuccess("Popular vehicle services updated.");
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update popular vehicle services",
      );
    } finally {
      setSavingPopular(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">Services</h2>
          <p className="mt-1 text-sm text-muted">
            Manage service categories, services, and thumbnails.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:min-w-[260px]">
          <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-medium text-muted">
              Active categories
            </div>
            <div className="mt-1 text-xl font-bold text-ink">
              {activeCategoryCount}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-medium text-muted">
              Active services
            </div>
            <div className="mt-1 text-xl font-bold text-ink">
              {activeServiceCount}
            </div>
          </div>
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

      {isIntern ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          Intern access is read-only. An admin must create or change categories and services.
        </div>
      ) : (
        <>
      <form
        onSubmit={saveCategory}
        className="card-soft rounded-2xl p-4 shadow-sm"
      >
        <div className="mb-3">
          <h3 className="text-sm font-bold text-ink">
            {categoryForm.id ? "Edit Category" : "Add Category"}
          </h3>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr_220px_160px_auto]">
          <input
            required
            value={categoryForm.name}
            onChange={(event) =>
              setCategoryForm({ ...categoryForm, name: event.target.value })
            }
            placeholder="Service category"
            className={fieldClass}
          />

          <input
            value={categoryForm.description}
            onChange={(event) =>
              setCategoryForm({
                ...categoryForm,
                description: event.target.value,
              })
            }
            placeholder="Category description"
            className={fieldClass}
          />

          <label className={fileClass}>
            <FiImage className="shrink-0" />
            <span className="truncate">
              {categoryForm.thumbnail?.name || "Category thumbnail"}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(event) =>
                setCategoryThumbnail(event.target.files?.[0])
              }
              className="hidden"
            />
          </label>

          <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={categoryForm.isComingSoon}
              onChange={(event) =>
                setCategoryForm({
                  ...categoryForm,
                  isComingSoon: event.target.checked,
                })
              }
              className="h-4 w-4 accent-ink"
            />
            Coming Soon
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 text-sm font-bold text-black transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPlus />
              {saving
                ? "Saving..."
                : categoryForm.id
                  ? "Update"
                  : "Add"}
            </button>

            {categoryForm.id && (
              <button
                type="button"
                onClick={() => {
                  setCategoryForm(emptyCategoryForm);
                  setCategoryCitySearch("");
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                aria-label="Cancel category edit"
              >
                <FiX />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3">
          <RestrictedCityPicker
            description="Logged-in customers in selected cities will not see this category or any service inside it. Service-level restrictions can still add more restricted cities."
            cities={cities}
            selectedCityIds={categoryForm.restrictedCityIds}
            search={categoryCitySearch}
            onSearchChange={setCategoryCitySearch}
            onToggle={toggleCategoryRestrictedCity}
            onClear={() =>
              setCategoryForm((current) => ({
                ...current,
                restrictedCityIds: [],
              }))
            }
          />
        </div>
      </form>

      <form
        onSubmit={saveService}
        className="card-soft rounded-2xl p-4 shadow-sm"
      >
        <div className="mb-3">
          <h3 className="text-sm font-bold text-ink">
            {serviceForm.id ? "Edit Service" : "Add Service"}
          </h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            required
            value={serviceForm.categoryId}
            onChange={(event) =>
              setServiceForm({
                ...serviceForm,
                categoryId: event.target.value,
              })
            }
            className={fieldClass}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <input
            required
            value={serviceForm.name}
            onChange={(event) =>
              setServiceForm({ ...serviceForm, name: event.target.value })
            }
            placeholder="Service name"
            className={fieldClass}
          />

          <label className={`${fileClass} md:col-span-1 xl:col-span-2`}>
            <FiImage className="shrink-0" />
            <span className="truncate">
              {serviceForm.thumbnail?.name || "Service thumbnail"}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(event) => setThumbnail(event.target.files?.[0])}
              className="hidden"
            />
          </label>

          <textarea
            value={serviceForm.description}
            onChange={(event) =>
              setServiceForm({
                ...serviceForm,
                description: event.target.value,
              })
            }
            placeholder="Service description"
            rows={2}
            className={`${textareaClass} md:col-span-1 xl:col-span-2`}
          />

          <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={serviceForm.isComingSoon}
              onChange={(event) =>
                setServiceForm({
                  ...serviceForm,
                  isComingSoon: event.target.checked,
                })
              }
              className="h-4 w-4 accent-ink"
            />
            Coming Soon
          </label>

          <fieldset className="md:col-span-2 xl:col-span-4 rounded-xl border border-line bg-bg-soft/60 p-3">
            <legend className="px-1 text-sm font-bold text-ink">
              Customer vehicle movement
            </legend>
            <p className="mb-3 text-xs leading-5 text-muted">
              Most services allow the customer to choose pickup or self drop-off at checkout. Use self drop-off only for services that must never be collected by a garage.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                {
                  value: "BOTH",
                  title: "Customer can choose either",
                  description:
                    "At checkout the customer can select pickup & delivery or self drop-off & pickup.",
                  icon: FiTruck,
                },
                {
                  value: "SELF_DROP_OFF",
                  title: "Self drop-off only",
                  description:
                    "Pickup is disabled for this service. The customer must take the vehicle to the assigned garage and collect it after service.",
                  icon: FiMapPin,
                },
              ].map((option) => {
                const selected = serviceForm.fulfillmentType === option.value;
                const Icon = option.icon;

                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      selected
                        ? "border-ink bg-white shadow-sm"
                        : "border-line bg-white/70 hover:border-ink/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="serviceFulfillmentType"
                      value={option.value}
                      checked={selected}
                      onChange={(event) =>
                        setServiceForm((current) => ({
                          ...current,
                          fulfillmentType: event.target.value,
                        }))
                      }
                      className="sr-only"
                    />
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                        selected ? "bg-lime-300 text-black" : "bg-bg-soft text-muted"
                      }`}
                    >
                      <Icon />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-bold text-ink">
                        {option.title}
                        {selected && <FiCheckCircle className="text-green-700" />}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="md:col-span-2 xl:col-span-4">
            <RestrictedCityPicker
              description="Logged-in customers in selected cities will not see this service. These restrictions are added on top of any category-level restrictions."
              cities={cities}
              selectedCityIds={serviceForm.restrictedCityIds}
              search={serviceCitySearch}
              onSearchChange={setServiceCitySearch}
              onToggle={toggleServiceRestrictedCity}
              onClear={() =>
                setServiceForm((current) => ({
                  ...current,
                  restrictedCityIds: [],
                }))
              }
            />
          </div>

          <div className="flex gap-2 xl:justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 text-sm font-bold text-black transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPlus />
              {saving
                ? "Saving..."
                : serviceForm.id
                  ? "Update"
                  : "Add"}
            </button>

            {serviceForm.id && (
              <button
                type="button"
                onClick={() => {
                  setServiceForm({
                    ...emptyServiceForm,
                    categoryId: serviceForm.categoryId,
                  });
                  setServiceCitySearch("");
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                aria-label="Cancel service edit"
              >
                <FiX />
              </button>
            )}
          </div>
        </div>
      </form>
        </>
      )}

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-800">
                <FiStar />
              </span>
              <div>
                <h3 className="text-base font-bold text-ink">
                  Popular Vehicle Services
                </h3>
                <p className="mt-0.5 text-xs leading-5 text-muted">
                  Choose and order the services shown on the customer home page.
                </p>
              </div>
            </div>
          </div>

          <span className="w-fit rounded-full bg-bg-soft px-3 py-1.5 text-xs font-bold text-ink">
            {popularServiceDraft.length}/{MAX_POPULAR_SERVICES} selected
          </span>
        </div>

        {!isIntern && (
          <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select
              value={popularServiceToAdd}
              onChange={(event) => setPopularServiceToAdd(event.target.value)}
              disabled={
                popularServiceDraft.length >= MAX_POPULAR_SERVICES ||
                availablePopularServices.length === 0
              }
              className={fieldClass}
            >
              <option value="">
                {popularServiceDraft.length >= MAX_POPULAR_SERVICES
                  ? "Maximum 6 services selected"
                  : "Select an active service"}
              </option>
              {availablePopularServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.categoryName} — {service.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={addPopularService}
              disabled={!popularServiceToAdd}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiPlus />
              Add to home
            </button>
          </div>
        )}

        <div className="mt-4 grid gap-2">
          {selectedPopularServices.map((service, index) => {
            const thumbnail = getThumbnail(service);

            return (
              <div
                key={service.id}
                className="grid gap-3 rounded-xl border border-line bg-white p-3 sm:grid-cols-[40px_48px_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-bg-soft text-sm font-extrabold text-ink">
                  {index + 1}
                </div>

                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-bg-soft">
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FiImage className="text-muted" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">
                    {service.name}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {service.categoryName}
                  </div>
                </div>

                {!isIntern && (
                  <div className="flex items-center gap-1 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => movePopularService(service.id, -1)}
                      disabled={index === 0}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={`Move ${service.name} up`}
                      title="Move up"
                    >
                      <FiArrowUp />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePopularService(service.id, 1)}
                      disabled={index === selectedPopularServices.length - 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={`Move ${service.name} down`}
                      title="Move down"
                    >
                      <FiArrowDown />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePopularService(service.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700 transition hover:bg-red-100"
                      aria-label={`Remove ${service.name} from home`}
                      title="Remove from home"
                    >
                      <FiX />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {selectedPopularServices.length === 0 && (
            <div className="rounded-xl border border-dashed border-line bg-bg-soft/60 p-5 text-center text-sm text-muted">
              No popular services selected. The home page will show an empty-state message
              until an admin adds services here.
            </div>
          )}
        </div>

        {!isIntern && (
          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-muted">
              Only active services from active categories can be selected. City and
              service restrictions still apply for each customer.
            </p>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setPopularServiceDraft(popularServiceIds)}
                disabled={!popularSelectionChanged || savingPopular}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-bold text-ink transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={savePopularServices}
                disabled={!popularSelectionChanged || savingPopular}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 text-sm font-bold text-black transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiSave />
                {savingPopular ? "Saving..." : "Save home services"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative min-w-0">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories/services"
              className="h-10 w-full rounded-lg border border-line pl-10 pr-3 text-sm outline-none transition focus:border-ink"
            />
          </label>

          <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Include inactive
          </label>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Search
          </button>
        </div>
      </section>

      <p className="px-1 text-xs leading-5 text-muted">
        Deactivation is a safe delete. Inactive records are hidden from
        customers and are shown here only when “Include inactive” is enabled.
        The “Mark Coming Soon” button is an action, not the current status.
      </p>

      <div className="grid gap-4">
        {loading ? (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            Loading services...
          </div>
        ) : categories.length ? (
          categories.map((category) => {
            const categoryComingSoon = isCategoryComingSoon(category);
            const categoryRestrictedCityNames =
              getRestrictedCityNames(category);

            return (
            <section
              key={category.id}
              className="card-soft overflow-hidden rounded-2xl shadow-sm"
            >
              <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-bg-soft">
                    {category.thumbnailUrl ? (
                      <img
                        src={category.thumbnailUrl}
                        alt={category.name}
                        className={`h-full w-full object-cover transition ${
                          categoryComingSoon
                            ? "scale-105 blur-sm grayscale"
                            : ""
                        }`}
                      />
                    ) : (
                      <FiImage className="text-muted" />
                    )}

                    {categoryComingSoon && (
                      <ComingSoonOverlay compact />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold text-ink">
                        {category.name}
                      </h3>

                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-bold",
                          category.isActive
                            ? "bg-lime-100 text-ink"
                            : "bg-bg-soft text-muted",
                        ].join(" ")}
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </span>

                      {categoryComingSoon && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                          Coming Soon
                        </span>
                      )}

                      {categoryRestrictedCityNames.length > 0 ? (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                          Restricted in: {categoryRestrictedCityNames.join(", ")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                          All cities
                        </span>
                      )}
                    </div>

                    <p className="mt-1 line-clamp-1 text-sm text-muted">
                      {category.description || "No category description."}
                    </p>
                  </div>
                </div>

                {!isIntern && (
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => toggleCategoryComingSoon(category)}
                    disabled={
                      togglingCategoryId === category.id ||
                      !toBoolean(category.isActive)
                    }
                    className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      categoryComingSoon
                        ? "bg-lime-100 text-ink hover:bg-lime-200"
                        : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                    }`}
                  >
                    {togglingCategoryId === category.id
                      ? "Updating..."
                      : categoryComingSoon
                        ? "Make Available"
                        : "Mark Coming Soon"}
                  </button>

                  <button
                    type="button"
                    onClick={() => editCategory(category)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                    aria-label="Edit category"
                  >
                    <FiEdit3 />
                  </button>

                  {(!isIntern || !toBoolean(category.isActive)) && (
                    <button
                      type="button"
                      onClick={() => toggleCategoryActive(category)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${
                        toBoolean(category.isActive)
                          ? "bg-red-50 text-red-700 hover:bg-red-100"
                          : "bg-lime-100 text-ink hover:bg-lime-200"
                      }`}
                      aria-label={
                        toBoolean(category.isActive)
                          ? "Deactivate category"
                          : "Reactivate category"
                      }
                      title={
                        toBoolean(category.isActive)
                          ? "Deactivate category"
                          : "Reactivate category"
                      }
                    >
                      {toBoolean(category.isActive) ? (
                        <FiTrash2 />
                      ) : (
                        <FiCheckCircle />
                      )}
                    </button>
                  )}
                </div>
                )}
              </div>

              <div className="grid gap-2 p-4">
                {(category.services || []).length ? (
                  category.services.map((service) => {
                    const thumbnail = getThumbnail(service);
                    const serviceComingSoon = isServiceComingSoon(service);
                    const effectiveComingSoon =
                      categoryComingSoon || serviceComingSoon;
                    const serviceActive = toBoolean(service.isActive);
                    const serviceRestrictedCityNames =
                      getRestrictedCityNames(service);

  return (
                      <div
                        key={service.id}
                        className="grid gap-3 rounded-xl border border-line p-3 transition hover:bg-bg-soft/70 sm:grid-cols-[56px_minmax(0,1fr)_auto]"
                      >
                        <div className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-bg-soft">
                          {thumbnail ? (
                            <img
                              src={thumbnail}
                              alt={service.name}
                              className={`h-full w-full object-cover transition ${
                                effectiveComingSoon
                                  ? "scale-105 blur-sm grayscale"
                                  : ""
                              }`}
                            />
                          ) : (
                            <FiImage className="text-muted" />
                          )}

                          {effectiveComingSoon && (
                            <ComingSoonOverlay compact />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold text-ink">
                              {service.name}
                            </div>

                            <span
                              className={[
                                "rounded-full px-2.5 py-1 text-xs font-bold",
                                serviceActive
                                  ? "bg-lime-100 text-ink"
                                  : "bg-bg-soft text-muted",
                              ].join(" ")}
                            >
                              {serviceActive ? "Active" : "Inactive"}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                                service.fulfillmentType === "SELF_DROP_OFF"
                                  ? "bg-violet-100 text-violet-800"
                                  : "bg-sky-50 text-sky-700"
                              }`}
                            >
                              {service.fulfillmentType === "SELF_DROP_OFF" ? (
                                <FiMapPin />
                              ) : (
                                <FiTruck />
                              )}
                              {service.fulfillmentType === "SELF_DROP_OFF"
                                ? "Self drop-off only"
                                : "Pickup or self drop-off"}
                            </span>

                            {serviceComingSoon && (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                                Coming Soon
                              </span>
                            )}

                            {categoryComingSoon && (
                              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800">
                                Category Coming Soon
                              </span>
                            )}

                            {serviceRestrictedCityNames.length > 0 ? (
                              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                                Service restricted: {serviceRestrictedCityNames.join(", ")}
                              </span>
                            ) : categoryRestrictedCityNames.length > 0 ? (
                              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                                Uses category restrictions
                              </span>
                            ) : (
                              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                                All cities
                              </span>
                            )}
                          </div>

                          <p className="mt-1 line-clamp-1 text-sm text-muted">
                            {service.description || "No service description."}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-muted">
                            Position {
                              (category.services || []).findIndex(
                                (item) => item.id === service.id,
                              ) + 1
                            } of {(category.services || []).length}
                          </p>

                        </div>

                        {!isIntern && (
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <div className="inline-flex overflow-hidden rounded-lg border border-line bg-white">
                            <button
                              type="button"
                              onClick={() =>
                                moveCategoryService(category, service.id, -1)
                              }
                              disabled={
                                reorderingCategoryId === category.id ||
                                (category.services || [])[0]?.id === service.id
                              }
                              className="inline-flex h-9 w-9 items-center justify-center text-ink transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-35"
                              aria-label={`Move ${service.name} up`}
                              title="Move service up"
                            >
                              <FiArrowUp />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                moveCategoryService(category, service.id, 1)
                              }
                              disabled={
                                reorderingCategoryId === category.id ||
                                (category.services || [])[
                                  (category.services || []).length - 1
                                ]?.id === service.id
                              }
                              className="inline-flex h-9 w-9 items-center justify-center border-l border-line text-ink transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-35"
                              aria-label={`Move ${service.name} down`}
                              title="Move service down"
                            >
                              <FiArrowDown />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleComingSoon(service)}
                            disabled={
                              !serviceActive ||
                              togglingServiceId === service.id
                            }
                            className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              serviceComingSoon
                                ? "bg-lime-100 text-ink hover:bg-lime-200"
                                : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                            }`}
                            title={
                              serviceActive
                                ? serviceComingSoon
                                  ? "Make this service bookable"
                                  : "Keep visible but prevent booking"
                                : "Reactivate this service first"
                            }
                          >
                            {togglingServiceId === service.id
                              ? "Updating..."
                              : serviceComingSoon
                                ? "Make Available"
                                : "Mark Coming Soon"}
                          </button>

                          <button
                            type="button"
                            onClick={() => openCoverageEditor(service)}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-bold text-sky-800 transition hover:border-sky-300 hover:bg-sky-100"
                            aria-label={`Edit coverage for ${service.name}`}
                          >
                            <FiEdit3 />
                            Edit coverage
                          </button>

                          <button
                            type="button"
                            onClick={() => editService(service)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                            aria-label="Edit service"
                          >
                            <FiEdit3 />
                          </button>

                          {(!isIntern || !serviceActive) && (
                            <button
                              type="button"
                              onClick={() => toggleServiceActive(service)}
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${
                                serviceActive
                                  ? "bg-red-50 text-red-700 hover:bg-red-100"
                                  : "bg-lime-100 text-ink hover:bg-lime-200"
                              }`}
                              aria-label={
                                serviceActive
                                  ? "Deactivate service"
                                  : "Reactivate service"
                              }
                              title={
                                serviceActive
                                  ? "Deactivate service"
                                  : "Reactivate service"
                              }
                            >
                              {serviceActive ? (
                                <FiTrash2 />
                              ) : (
                                <FiCheckCircle />
                              )}
                            </button>
                          )}
                        </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl bg-bg-soft p-4 text-sm text-muted">
                    No services in this category yet.
                  </div>
                )}
              </div>
            </section>
            );
          })
        ) : (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            No service categories found.
          </div>
        )}
      </div>

      {coverageService && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-coverage-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCoverageEditor();
          }}
        >
          <form
            onSubmit={saveCoverage}
            className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="service-coverage-title" className="text-lg font-bold text-ink">
                  Edit service coverage
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {coverageService.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCoverageEditor}
                disabled={savingCoverage}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink transition hover:bg-bg-soft disabled:opacity-50"
                aria-label="Close coverage editor"
              >
                <FiX />
              </button>
            </div>

            <label className="mt-5 block text-sm font-bold text-ink">
              Coverage items
              <textarea
                autoFocus
                value={coverageService.coverage}
                onChange={(event) =>
                  setCoverageService((current) => ({
                    ...current,
                    coverage: event.target.value,
                  }))
                }
                rows={8}
                placeholder={"Service inspection\nBasic checks\nOil replacement"}
                className={`${textareaClass} mt-2 w-full`}
              />
            </label>
            <p className="mt-2 text-xs leading-5 text-muted">
              Enter one coverage item per line. These items appear under “Coverage” and
              “Services Coverage” on the customer service page.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCoverageEditor}
                disabled={savingCoverage}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-bold text-ink transition hover:bg-bg-soft disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingCoverage}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiEdit3 />
                {savingCoverage ? "Saving coverage..." : "Save coverage"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
