import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import {
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
  "min-w-0 rounded-xl border border-line px-4 py-3 text-base leading-6 outline-none placeholder:text-muted focus:border-ink";
const compactFieldClass =
  "min-w-0 rounded-xl border border-line px-4 py-3 text-base leading-6 outline-none placeholder:text-muted focus:border-ink";
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
    [categories],
  );

  const activeServiceCount = useMemo(
    () =>
      categories.reduce(
        (sum, category) =>
          sum + (category.services || []).filter((service) => service.isActive).length,
        0,
      ),
    [categories],
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
      `Deactivate ${category.name} and its services from customer selection?`,
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
    if (Number.isNaN(minPrice) || Number.isNaN(maxPrice) || Number.isNaN(basePrice)) {
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
    const ok = window.confirm(`Deactivate ${service.name} from customer selection?`);
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
    <div className="w-full max-w-full overflow-x-hidden space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Services</h2>
          <p className="mt-1 text-sm text-muted sm:text-base">
            Manage service categories, services, and Cloudinary thumbnails.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[280px]">
          <div className="rounded-xl border border-line bg-white px-4 py-3">
            <div className="text-muted">Active categories</div>
            <div className="text-2xl font-bold">{activeCategoryCount}</div>
          </div>
          <div className="rounded-xl border border-line bg-white px-4 py-3">
            <div className="text-muted">Active services</div>
            <div className="text-2xl font-bold">{activeServiceCount}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <form
        onSubmit={saveCategory}
        className="card-soft grid gap-3 p-4 sm:p-5 lg:grid-cols-[1fr_1.4fr_220px_auto]"
      >
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
        <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-medium">
          <FiImage className="shrink-0" />
          <span className="truncate">
            {categoryForm.thumbnail?.name || "Category thumbnail"}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={(event) => setCategoryThumbnail(event.target.files?.[0])}
            className="hidden"
          />
        </label>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <button
            disabled={saving}
            className="btn-primary min-h-12 whitespace-nowrap !rounded-xl px-6"
          >
            {saving ? "Saving..." : categoryForm.id ? "Update Category" : "Add Category"}
          </button>
          {categoryForm.id && (
            <button
              type="button"
              onClick={() => setCategoryForm(emptyCategoryForm)}
              className="btn-ghost !px-3"
              aria-label="Cancel category edit"
            >
              <FiX />
            </button>
          )}
        </div>
      </form>

      <form
        onSubmit={saveService}
        className="card-soft grid gap-4 p-4 sm:p-5 lg:grid-cols-2 xl:grid-cols-[minmax(220px,0.9fr)_minmax(280px,1.2fr)_repeat(3,minmax(150px,0.7fr))]"
      >
        <select
          required
          value={serviceForm.categoryId}
          onChange={(event) =>
            setServiceForm({ ...serviceForm, categoryId: event.target.value })
          }
          className={compactFieldClass}
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
            setServiceForm({ ...serviceForm, basePrice: event.target.value })
          }
          placeholder="Base price"
          className={compactFieldClass}
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
          className={compactFieldClass}
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
          className={compactFieldClass}
        />
        <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-medium lg:col-span-1 xl:col-span-2">
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
            setServiceForm({ ...serviceForm, description: event.target.value })
          }
          placeholder="Service description"
          className={`${fieldClass} lg:col-span-1 xl:col-span-3`}
          rows={2}
        />
        <div className="flex min-w-0 flex-wrap items-start justify-end gap-2 xl:col-span-2">
          <button
            disabled={saving}
            className="btn-primary min-h-12 whitespace-nowrap !rounded-xl px-6"
          >
            {saving ? "Saving..." : serviceForm.id ? "Update Service" : "Add Service"}
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
              className="btn-ghost !px-3"
              aria-label="Cancel service edit"
            >
              <FiX />
            </button>
          )}
        </div>
      </form>

      <div className="flex w-full max-w-full flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search categories/services"
            className="w-full rounded-xl border border-line py-2 pl-11 pr-4 outline-none focus:border-ink"
          />
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm">
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
          className="btn-ghost justify-center !py-2"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="card-soft p-6 text-muted">Loading services...</div>
        ) : categories.length ? (
          categories.map((category) => (
            <section key={category.id} className="card-soft overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-bg-soft">
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
                      <h3 className="truncate text-lg font-semibold">
                        {category.name}
                      </h3>
                      <span className={category.isActive ? "chip-brand" : "chip"}>
                        {category.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {category.description || "No category description."}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => editCategory(category)}
                    className="btn-ghost !px-3 !py-2"
                    aria-label="Edit category"
                  >
                    <FiEdit3 />
                  </button>
                  <button
                    type="button"
                    onClick={() => deactivateCategory(category)}
                    className="rounded-xl bg-red-50 px-3 py-2 text-red-700"
                    aria-label="Deactivate category"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 p-4">
                {(category.services || []).map((service) => {
                  const thumbnail = getThumbnail(service);
                  return (
                    <div
                      key={service.id}
                      className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[72px_minmax(0,1fr)_auto]"
                    >
                      <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl bg-bg-soft">
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
                          <div className="font-semibold">{service.name}</div>
                          <span className={service.isActive ? "chip-brand" : "chip"}>
                            {service.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted">
                          {service.description || "No service description."}
                        </p>
                        <div className="mt-2 text-sm font-semibold">
                          {money(service.minPrice)} - {money(service.maxPrice)}
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-wrap gap-2 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => editService(service)}
                          className="btn-ghost !px-3 !py-2"
                          aria-label="Edit service"
                        >
                          <FiEdit3 />
                        </button>
                        <button
                          type="button"
                          onClick={() => deactivateService(service)}
                          className="rounded-xl bg-red-50 px-3 py-2 text-red-700"
                          aria-label="Deactivate service"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {category.services?.length === 0 && (
                  <div className="rounded-xl bg-bg-soft p-4 text-sm text-muted">
                    No services in this category yet.
                  </div>
                )}
              </div>
            </section>
          ))
        ) : (
          <div className="card-soft p-6 text-muted">No service categories found.</div>
        )}
      </div>
    </div>
  );
}
