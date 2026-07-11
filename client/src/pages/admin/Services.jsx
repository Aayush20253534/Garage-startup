import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiEdit3,
  FiImage,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

const emptyCategoryForm = {
  id: "",
  name: "",
  description: "",
  isActive: true,
  isComingSoon: false,
  thumbnail: null,
};

const emptyServiceForm = {
  id: "",
  categoryId: "",
  name: "",
  description: "",
  isActive: true,
  isComingSoon: false,
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

export default function AdminServices() {
  const { user } = useApp();
  const isIntern = user?.role === "INTERN";
  const [categories, setCategories] = useState([]);
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

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await adminApi.getServiceCategories({
        includeInactive,
        ...(search.trim() && { search: search.trim() }),
      });

      setCategories(data || []);
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
      thumbnail: null,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
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
                onClick={() => setCategoryForm(emptyCategoryForm)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                aria-label="Cancel category edit"
              >
                <FiX />
              </button>
            )}
          </div>
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
                onClick={() =>
                  setServiceForm({
                    ...emptyServiceForm,
                    categoryId: serviceForm.categoryId,
                  })
                }
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
                          </div>

                          <p className="mt-1 line-clamp-1 text-sm text-muted">
                            {service.description || "No service description."}
                          </p>

                        </div>

                        {!isIntern && (
                        <div className="flex flex-wrap gap-2 sm:justify-end">
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
    </div>
  );
}
