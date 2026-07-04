import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
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
  thumbnail: null,
};

const emptyServiceForm = {
  id: "",
  categoryId: "",
  name: "",
  description: "",
  basePrice: "",
  minPrice: "",
  maxPrice: "",
  isActive: true,
  thumbnail: null,
};

const money = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;

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

export default function AdminServices() {
  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      thumbnail: null,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deactivateCategory = async (category) => {
    const ok = window.confirm(
      `Deactivate ${category.name} and its services from customer selection?`
    );
    if (!ok) return;

    setError("");
    setSuccess("");

    try {
      await adminApi.deleteServiceCategory(category.id);
      setSuccess("Service category deactivated.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to deactivate category");
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

    const minPrice = Number(serviceForm.minPrice);
    const maxPrice = Number(serviceForm.maxPrice);
    const basePrice =
      serviceForm.basePrice === "" ? minPrice : Number(serviceForm.basePrice);

    if (!serviceForm.categoryId || !serviceForm.name.trim()) {
      setError("Select a category and enter a service name.");
      return;
    }

    if (
      Number.isNaN(minPrice) ||
      Number.isNaN(maxPrice) ||
      Number.isNaN(basePrice)
    ) {
      setError("Enter valid service prices.");
      return;
    }

    if (maxPrice < minPrice) {
      setError("Max price cannot be less than min price.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        categoryId: serviceForm.categoryId,
        name: serviceForm.name.trim(),
        description: serviceForm.description.trim() || null,
        basePrice,
        minPrice,
        maxPrice,
        isActive: serviceForm.isActive,
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
      basePrice: service.basePrice ?? "",
      minPrice: service.minPrice ?? "",
      maxPrice: service.maxPrice ?? "",
      isActive: Boolean(service.isActive),
      thumbnail: null,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deactivateService = async (service) => {
    const ok = window.confirm(
      `Deactivate ${service.name} from customer selection?`
    );
    if (!ok) return;

    setError("");
    setSuccess("");

    try {
      await adminApi.deleteService(service.id);
      setSuccess("Service deactivated.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to deactivate service");
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

      <form
        onSubmit={saveCategory}
        className="card-soft rounded-2xl p-4 shadow-sm"
      >
        <div className="mb-3">
          <h3 className="text-sm font-bold text-ink">
            {categoryForm.id ? "Edit Category" : "Add Category"}
          </h3>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr_220px_auto]">
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

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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

          <input
            type="number"
            min="0"
            value={serviceForm.basePrice}
            onChange={(event) =>
              setServiceForm({
                ...serviceForm,
                basePrice: event.target.value,
              })
            }
            placeholder="Base price"
            className={fieldClass}
          />

          <input
            required
            type="number"
            min="0"
            value={serviceForm.minPrice}
            onChange={(event) =>
              setServiceForm({ ...serviceForm, minPrice: event.target.value })
            }
            placeholder="Min price"
            className={fieldClass}
          />

          <input
            required
            type="number"
            min="0"
            value={serviceForm.maxPrice}
            onChange={(event) =>
              setServiceForm({ ...serviceForm, maxPrice: event.target.value })
            }
            placeholder="Max price"
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

      <div className="grid gap-4">
        {loading ? (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            Loading services...
          </div>
        ) : categories.length ? (
          categories.map((category) => (
            <section
              key={category.id}
              className="card-soft overflow-hidden rounded-2xl shadow-sm"
            >
              <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-bg-soft">
                    {category.thumbnailUrl ? (
                      <img
                        src={category.thumbnailUrl}
                        alt={category.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FiImage className="text-muted" />
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
                    </div>

                    <p className="mt-1 line-clamp-1 text-sm text-muted">
                      {category.description || "No category description."}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => editCategory(category)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                    aria-label="Edit category"
                  >
                    <FiEdit3 />
                  </button>

                  <button
                    type="button"
                    onClick={() => deactivateCategory(category)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700 transition hover:bg-red-100"
                    aria-label="Deactivate category"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>

              <div className="grid gap-2 p-4">
                {(category.services || []).length ? (
                  category.services.map((service) => {
                    const thumbnail = getThumbnail(service);

                    return (
                      <div
                        key={service.id}
                        className="grid gap-3 rounded-xl border border-line p-3 transition hover:bg-bg-soft/70 sm:grid-cols-[56px_minmax(0,1fr)_auto]"
                      >
                        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-bg-soft">
                          {thumbnail ? (
                            <img
                              src={thumbnail}
                              alt={service.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FiImage className="text-muted" />
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
                                service.isActive
                                  ? "bg-lime-100 text-ink"
                                  : "bg-bg-soft text-muted",
                              ].join(" ")}
                            >
                              {service.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>

                          <p className="mt-1 line-clamp-1 text-sm text-muted">
                            {service.description || "No service description."}
                          </p>

                          <div className="mt-1 text-sm font-semibold text-ink">
                            {money(service.minPrice)} - {money(service.maxPrice)}
                          </div>
                        </div>

                        <div className="flex gap-2 sm:justify-end">
                          <button
                            type="button"
                            onClick={() => editService(service)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                            aria-label="Edit service"
                          >
                            <FiEdit3 />
                          </button>

                          <button
                            type="button"
                            onClick={() => deactivateService(service)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700 transition hover:bg-red-100"
                            aria-label="Deactivate service"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
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
          ))
        ) : (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            No service categories found.
          </div>
        )}
      </div>
    </div>
  );
}