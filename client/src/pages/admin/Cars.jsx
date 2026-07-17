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

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

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
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
      if (modelForm.id) {
        await adminApi.updateCarModel(modelForm.id, {
          name: modelName,
          isActive: modelForm.isActive !== false,
        });

        setSuccess("Car model updated.");
      } else {
        await adminApi.createCarModel(brand.id, {
          name: modelName,
          isActive: true,
        });

        setSuccess("Car model added.");
      }

      setModelForms((current) => ({
        ...current,
        [brand.id]: {
          name: "",
          id: "",
          isActive: true,
        },
      }));

      await load();
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
      },
    }));
  };

  const deactivateModel = async (model) => {
    const ok = window.confirm(
      `Deactivate ${model.name} from customer selection?`
    );

    if (!ok) return;

    setError("");
    setSuccess("");

    try {
      await adminApi.deleteCarModel(model.id);
      setSuccess("Car model deactivated.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to deactivate car model");
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
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative min-w-0">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search brands"
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
            Loading cars...
          </div>
        ) : brands.length ? (
          brands.map((brand) => {
            const modelForm = modelForms[brand.id] || {
              name: "",
              id: "",
              isActive: true,
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
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
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

                  <div className="flex flex-wrap gap-2">
                    {(brand.models || []).length ? (
                      brand.models.map((model) => (
                        <span
                          key={model.id}
                          className={[
                            "inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                            model.isActive
                              ? "border-line bg-white text-ink"
                              : "border-line bg-bg-soft text-muted",
                          ].join(" ")}
                        >
                          <span className="truncate">{model.name}</span>

                          <button
                            type="button"
                            onClick={() => editModel(brand, model)}
                            className="text-ink"
                            aria-label={`Edit ${model.name}`}
                          >
                            <FiEdit3 />
                          </button>

                          <button
                            type="button"
                            onClick={() => deactivateModel(model)}
                            className="text-red-600"
                            aria-label={`Deactivate ${model.name}`}
                          >
                            <FiX />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted">
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
