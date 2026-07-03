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

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const emptyBrandForm = {
  id: "",
  name: "",
  models: "",
  isActive: true,
  logo: null,
};

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
    [brands],
  );

  const modelCount = useMemo(
    () =>
      brands.reduce(
        (sum, brand) =>
          sum + (brand.models || []).filter((model) => model.isActive).length,
        0,
      ),
    [brands],
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
      `Deactivate ${brand.name} and its models from customer selection?`,
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
        [brand.id]: { name: "", id: "", isActive: true },
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

  const deactivateModel = async (model) => {
    const ok = window.confirm(`Deactivate ${model.name} from customer selection?`);
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
    <div className="w-full max-w-full overflow-x-hidden space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Cars</h2>
          <p className="mt-1 text-sm text-muted sm:text-base">
            Upload Cloudinary logos for seeded brands and adjust models only when needed.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[260px]">
          <div className="rounded-xl border border-line bg-white px-4 py-3">
            <div className="text-muted">Active brands</div>
            <div className="text-2xl font-bold">{activeCount}</div>
          </div>
          <div className="rounded-xl border border-line bg-white px-4 py-3">
            <div className="text-muted">Active models</div>
            <div className="text-2xl font-bold">{modelCount}</div>
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
        onSubmit={saveBrand}
        className="card-soft grid gap-3 p-4 sm:p-5 lg:grid-cols-[1fr_1.4fr_220px_auto]"
      >
        <input
          required
          value={brandForm.name}
          onChange={(event) =>
            setBrandForm({ ...brandForm, name: event.target.value })
          }
          placeholder="Car brand"
          className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
        />

        <input
          value={brandForm.models}
          onChange={(event) =>
            setBrandForm({ ...brandForm, models: event.target.value })
          }
          disabled={Boolean(brandForm.id)}
          placeholder="Models only for a new brand"
          className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink disabled:bg-bg-soft"
        />

        <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-medium">
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
          <button disabled={saving} className="btn-primary flex-1">
            {saving ? "Saving..." : brandForm.id ? "Update" : "Add"}
          </button>

          {brandForm.id && (
            <button
              type="button"
              onClick={() => setBrandForm(emptyBrandForm)}
              className="btn-ghost !px-3"
              aria-label="Cancel brand edit"
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
            placeholder="Search brand"
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
          <div className="card-soft p-6 text-muted">Loading cars...</div>
        ) : brands.length ? (
          brands.map((brand) => {
            const modelForm = modelForms[brand.id] || {
              name: "",
              id: "",
              isActive: true,
            };

            return (
              <section key={brand.id} className="card-soft overflow-hidden">
                <div className="flex flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-line bg-white">
                      {brand.logoUrl ? (
                        <img
                          src={brand.logoUrl}
                          alt={brand.name}
                          className="h-10 w-10 object-contain"
                        />
                      ) : (
                        <span className="text-lg font-bold">
                          {brand.name.charAt(0)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold">
                        {brand.name}
                      </div>
                      <div className="text-sm text-muted">
                        {(brand.models || []).length} models
                      </div>
                    </div>

                    <span className={brand.isActive ? "chip-brand" : "chip"}>
                      {brand.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => editBrand(brand)}
                      className="btn-ghost !px-3 !py-2"
                      aria-label="Edit brand"
                    >
                      <FiEdit3 />
                    </button>
                    <button
                      type="button"
                      onClick={() => deactivateBrand(brand)}
                      className="rounded-xl bg-red-50 px-3 py-2 text-red-700"
                      aria-label="Deactivate brand"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
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
                      className="min-w-0 flex-1 rounded-xl border border-line px-4 py-2 outline-none focus:border-ink"
                    />

                    <button
                      type="button"
                      onClick={() => saveModel(brand)}
                      className="btn-primary justify-center !py-2"
                    >
                      <FiPlus />
                      {modelForm.id ? "Update Model" : "Add Model"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(brand.models || []).map((model) => (
                      <span
                        key={model.id}
                        className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                          model.isActive
                            ? "border-line bg-white"
                            : "border-line bg-bg-soft text-muted"
                        }`}
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
                    ))}

                    {brand.models?.length === 0 && (
                      <span className="text-sm text-muted">No models yet.</span>
                    )}
                  </div>
                </div>
              </section>
            );
          })
        ) : (
          <div className="card-soft p-6 text-muted">No car brands found.</div>
        )}
      </div>
    </div>
  );
}
