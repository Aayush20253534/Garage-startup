import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import SafeImage from "@/components/common/SafeImage";
import { getOptimizedImageUrl } from "@/utils/imageCache";
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

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_MODEL_PHOTO_BYTES = 2 * 1024 * 1024;

const emptyBrandForm = {
  id: "",
  name: "",
  models: "",
  isActive: true,
  logo: null,
};

const fieldClass =
  "h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition placeholder:text-muted focus:border-ink disabled:bg-bg-soft";

const fileClass =
  "flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium text-ink transition hover:bg-bg-soft";

export default function Cars() {
  const [brands, setBrands] = useState([]);
  const [brandForm, setBrandForm] = useState(emptyBrandForm);
  const [modelForms, setModelForms] = useState({});
  const [search, setSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingModelIds, setDeletingModelIds] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeCount = useMemo(
    () => brands.filter((brand) => brand.isActive).length,
    [brands]
  );

  const modelCount = useMemo(
    () =>
      brands.reduce(
        (sum, brand) =>
          sum + (brand.models || []).filter((model) => model.isActive).length,
        0
      ),
    [brands]
  );

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await adminApi.getCarBrands({
        includeInactive,
        ...(search.trim() && { search: search.trim() }),
        ...(modelSearch.trim() && { modelSearch: modelSearch.trim() }),
      });

      setBrands(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load cars");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setLogo = (file) => {
    setError("");

    if (!file) {
      setBrandForm((current) => ({ ...current, logo: null }));
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      setError("Logo must be under 2 MB.");
      return;
    }

    setBrandForm((current) => ({ ...current, logo: file }));
  };

  const setModelPhoto = (brandId, file) => {
    setError("");

    if (!file) {
      setModelForms((current) => ({
        ...current,
        [brandId]: {
          ...(current[brandId] || {}),
          photo: null,
        },
      }));
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Car model photo must be an image file.");
      return;
    }

    if (file.size > MAX_MODEL_PHOTO_BYTES) {
      setError("Car model photo must be under 2 MB.");
      return;
    }

    setModelForms((current) => ({
      ...current,
      [brandId]: {
        ...(current[brandId] || {}),
        photo: file,
      },
    }));
  };

  const buildBrandPayload = () => {
    const formData = new FormData();

    formData.append("name", brandForm.name.trim());
    formData.append("isActive", String(brandForm.isActive));

    if (!brandForm.id) {
      const models = brandForm.models
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean);

      formData.append("models", JSON.stringify(models));
    }

    if (brandForm.logo) {
      formData.append("logo", brandForm.logo);
    }

    return formData;
  };

  const saveBrand = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!brandForm.name.trim()) {
      setError("Enter a car brand name.");
      return;
    }

    setSaving(true);

    try {
      if (brandForm.id) {
        await adminApi.updateCarBrand(brandForm.id, buildBrandPayload());
        setSuccess("Car brand updated.");
      } else {
        await adminApi.createCarBrand(buildBrandPayload());
        setSuccess("Car brand created.");
      }

      setBrandForm(emptyBrandForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save car brand");
    } finally {
      setSaving(false);
    }
  };

  const editBrand = (brand) => {
    setBrandForm({
      id: brand.id,
      name: brand.name || "",
      models: "",
      isActive: Boolean(brand.isActive),
      logo: null,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deactivateBrand = async (brand) => {
    const ok = window.confirm(
      `Deactivate ${brand.name} and its models from customer selection?`
    );

    if (!ok) return;

    setError("");
    setSuccess("");

    try {
      await adminApi.deleteCarBrand(brand.id);
      setSuccess("Car brand deactivated.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to deactivate car brand");
    }
  };

  const saveModel = async (brand) => {
    const modelForm = modelForms[brand.id] || {};
    const modelName = String(modelForm.name || "").trim();

    if (!modelName) {
      setError("Enter a car model name.");
      return;
    }

    setError("");
    setSuccess("");

    try {
      let savedModel;
      const payload = new FormData();

      payload.append("name", modelName);
      payload.append("isActive", String(modelForm.isActive !== false));

      if (modelForm.photo) {
        payload.append("photo", modelForm.photo);
      }

      if (modelForm.id) {
        savedModel = await adminApi.updateCarModel(modelForm.id, payload);

        setSuccess("Car model updated.");
      } else {
        savedModel = await adminApi.createCarModel(brand.id, payload);

        setSuccess("Car model added.");
      }

      const normalizedModelSearch = modelSearch.trim().toLowerCase();
      const matchesModelSearch =
        !normalizedModelSearch ||
        String(savedModel.name || "")
          .toLowerCase()
          .includes(normalizedModelSearch);

      setBrands((current) =>
        current.flatMap((item) => {
          if (item.id !== brand.id) return [item];

          const models = (item.models || []).filter(
            (model) => model.id !== savedModel.id
          );

          if (matchesModelSearch) models.push(savedModel);
          models.sort((left, right) => left.name.localeCompare(right.name));

          if (normalizedModelSearch && !models.length) return [];
          return [{ ...item, models }];
        })
      );

      setModelForms((current) => ({
        ...current,
        [brand.id]: {
          name: "",
          id: "",
          isActive: true,
          photo: null,
          existingImageUrl: "",
        },
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save car model");
    }
  };

  const editModel = (brand, model) => {
    setModelForms((current) => ({
      ...current,
      [brand.id]: {
        id: model.id,
        name: model.name,
        isActive: Boolean(model.isActive),
        photo: null,
        existingImageUrl: model.imageUrl || "",
      },
    }));
  };

  const cancelModelEdit = (brandId) => {
    setModelForms((current) => ({
      ...current,
      [brandId]: {
        name: "",
        id: "",
        isActive: true,
        photo: null,
        existingImageUrl: "",
      },
    }));
  };

  const deleteModel = async (brandId, model) => {
    const ok = window.confirm(`Permanently delete ${model.name}?`);

    if (!ok) return;

    setError("");
    setSuccess("");
    setDeletingModelIds((current) => [...current, model.id]);

    try {
      await adminApi.deleteCarModel(model.id);
      setBrands((current) =>
        current.map((brand) =>
          brand.id === brandId
            ? {
                ...brand,
                models: (brand.models || []).filter(
                  (item) => item.id !== model.id
                ),
              }
            : brand
        )
      );
      setModelForms((current) =>
        current[brandId]?.id === model.id
          ? {
              ...current,
              [brandId]: {
                name: "",
                id: "",
                isActive: true,
                photo: null,
                existingImageUrl: "",
              },
            }
          : current
      );
      setSuccess("Car model deleted.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete car model");
    } finally {
      setDeletingModelIds((current) =>
        current.filter((modelId) => modelId !== model.id)
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">Cars</h2>
          <p className="mt-1 text-sm text-muted">
            Manage vehicle brands, models, and logos.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:min-w-[260px]">
          <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-medium text-muted">
              Active brands
            </div>
            <div className="mt-1 text-xl font-bold text-ink">
              {activeCount}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-medium text-muted">
              Active models
            </div>
            <div className="mt-1 text-xl font-bold text-ink">
              {modelCount}
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
        onSubmit={saveBrand}
        className="card-soft rounded-2xl p-4 shadow-sm"
      >
        <div className="mb-3">
          <h3 className="text-sm font-bold text-ink">
            {brandForm.id ? "Edit Brand" : "Add Brand"}
          </h3>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr_220px_auto]">
          <input
            required
            value={brandForm.name}
            onChange={(event) =>
              setBrandForm({ ...brandForm, name: event.target.value })
            }
            placeholder="Car brand"
            className={fieldClass}
          />

          <input
            value={brandForm.models}
            onChange={(event) =>
              setBrandForm({ ...brandForm, models: event.target.value })
            }
            disabled={Boolean(brandForm.id)}
            placeholder="Models only for new brand, comma separated"
            className={fieldClass}
          />

          <label className={fileClass}>
            <FiImage className="shrink-0" />
            <span className="truncate">
              {brandForm.logo?.name || "Upload logo"}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(event) => setLogo(event.target.files?.[0])}
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
              {saving ? "Saving..." : brandForm.id ? "Update" : "Add"}
            </button>

            {brandForm.id && (
              <button
                type="button"
                onClick={() => setBrandForm(emptyBrandForm)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                aria-label="Cancel brand edit"
              >
                <FiX />
              </button>
            )}
          </div>
        </div>
      </form>

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            load();
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
        >
          <label className="relative min-w-0">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search brands"
              className="h-10 w-full rounded-lg border border-line pl-10 pr-3 text-sm outline-none transition focus:border-ink"
            />
          </label>

          <label className="relative min-w-0">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={modelSearch}
              onChange={(event) => setModelSearch(event.target.value)}
              placeholder="Search models"
              aria-label="Search car models"
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
            type="submit"
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Search
          </button>
        </form>
      </section>

      <div className="grid gap-4">
        {loading ? (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            Loading cars...
          </div>
        ) : brands.length ? (
          brands.map((brand) => {
            const modelForm = modelForms[brand.id] || {
              name: "",
              id: "",
              isActive: true,
              photo: null,
              existingImageUrl: "",
            };

            return (
              <section
                key={brand.id}
                className="card-soft overflow-hidden rounded-2xl shadow-sm"
              >
                <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-line bg-white">
                      {brand.logoUrl ? (
                        <img
                          src={brand.logoUrl}
                          alt={brand.name}
                          className="h-10 w-10 object-contain"
                        />
                      ) : (
                        <span className="text-lg font-bold text-ink">
                          {brand.name?.charAt(0) || "?"}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-base font-bold text-ink">
                        {brand.name}
                      </div>
                      <div className="text-sm text-muted">
                        {(brand.models || []).length} models
                      </div>
                    </div>

                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-bold",
                        brand.isActive
                          ? "bg-lime-100 text-ink"
                          : "bg-bg-soft text-muted",
                      ].join(" ")}
                    >
                      {brand.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => editBrand(brand)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                      aria-label="Edit brand"
                    >
                      <FiEdit3 />
                    </button>

                    <button
                      type="button"
                      onClick={() => deactivateBrand(brand)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700 transition hover:bg-red-100"
                      aria-label="Deactivate brand"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 p-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
                    <input
                      value={modelForm.name}
                      onChange={(event) =>
                        setModelForms((current) => ({
                          ...current,
                          [brand.id]: {
                            ...modelForm,
                            name: event.target.value,
                          },
                        }))
                      }
                      placeholder="Add or edit model"
                      className={fieldClass}
                    />

                    <label className={fileClass}>
                      {modelForm.existingImageUrl && !modelForm.photo ? (
                        <SafeImage
                          src={getOptimizedImageUrl(
                            modelForm.existingImageUrl,
                            { width: 80 },
                          )}
                          alt="Current model"
                          className="h-7 w-10 shrink-0 rounded-md object-cover"
                          fallback={<FiImage className="shrink-0" />}
                        />
                      ) : (
                        <FiImage className="shrink-0" />
                      )}
                      <span className="truncate">
                        {modelForm.photo?.name ||
                          (modelForm.existingImageUrl
                            ? "Replace photo"
                            : "Upload photo")}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(event) =>
                          setModelPhoto(brand.id, event.target.files?.[0])
                        }
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => saveModel(brand)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 text-sm font-bold text-black transition hover:bg-lime-500"
                    >
                      <FiPlus />
                      {modelForm.id ? "Update" : "Add"}
                    </button>

                    {modelForm.id && (
                      <button
                        type="button"
                        onClick={() => cancelModelEdit(brand.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                        aria-label="Cancel model edit"
                      >
                        <FiX />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(brand.models || []).length ? (
                      brand.models.map((model) => (
                        <article
                          key={model.id}
                          className={[
                            "overflow-hidden rounded-xl border text-sm",
                            model.isActive
                              ? "border-line bg-white text-ink"
                              : "border-line bg-bg-soft text-muted",
                          ].join(" ")}
                        >
                          <div className="aspect-[16/9] border-b border-line bg-bg-soft">
                            <SafeImage
                              src={getOptimizedImageUrl(model.imageUrl, {
                                width: 480,
                              })}
                              alt={`${brand.name} ${model.name}`}
                              loading="lazy"
                              className="h-full w-full object-cover"
                              fallback={
                                <div className="grid h-full place-items-center text-3xl text-muted">
                                  <FiImage />
                                </div>
                              }
                            />
                          </div>

                          <div className="flex items-center gap-2 p-3">
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-bold text-ink">
                                {model.name}
                              </div>
                              <div className="mt-0.5 text-xs text-muted">
                                {model.imageUrl
                                  ? "Photo configured"
                                  : "Photo not added"}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => editModel(brand, model)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                              aria-label={`Edit ${model.name}`}
                            >
                              <FiEdit3 />
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteModel(brand.id, model)}
                              disabled={deletingModelIds.includes(model.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100 hover:text-red-700 disabled:cursor-wait disabled:opacity-40"
                              aria-label={`Delete ${model.name}`}
                            >
                              <FiTrash2
                                className={
                                  deletingModelIds.includes(model.id)
                                    ? "animate-pulse"
                                    : ""
                                }
                              />
                            </button>
                          </div>
                        </article>
                      ))
                    ) : (
                      <span className="text-sm text-muted sm:col-span-2 lg:col-span-3">
                        No models yet.
                      </span>
                    )}
                  </div>
                </div>
              </section>
            );
          })
        ) : (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            No car brands found.
          </div>
        )}
      </div>
    </div>
  );
}
