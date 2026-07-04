import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiEdit2,
  FiImage,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSave,
  FiX,
} from "react-icons/fi";
import CitySelect from "@/components/common/CitySelect";
import ImageUpload from "@/components/garage/ImageUpload";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";

const inputClass =
  "h-10 w-full rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink";

const textareaClass =
  "w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none transition focus:border-ink";

const getSupportedBrands = (garage) => {
  const value = garage?.supportedBrands;

  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getGarageImageUrl = (image) => image?.imageUrl || image?.url || "";

export default function GarageProfile() {
  const { garage } = useSelector((state) => state.garage);
  const { garageToken, refreshGarage, fetchVehicleMeta } = useApp();

  const [editingDetails, setEditingDetails] = useState(false);
  const [editingPhotos, setEditingPhotos] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [vehicleBrands, setVehicleBrands] = useState([]);
  const [photoFiles, setPhotoFiles] = useState([]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    phone: "",
    whatsappNo: "",
    email: "",
    address: "",
    city: "",
    area: "",
    workingRadiusKm: 15,
    garageType: "MULTI_BRAND",
    supportedBrands: [],
  });

  useEffect(() => {
    refreshGarage?.(garageToken).catch(() => {});
  }, [garageToken]);

  useEffect(() => {
    fetchVehicleMeta?.()
      .then((brands) => setVehicleBrands(Array.isArray(brands) ? brands : []))
      .catch(() => setVehicleBrands([]));
  }, [fetchVehicleMeta]);

  useEffect(() => {
    if (!garage || editingDetails) return;

    setForm({
      name: garage.name || "",
      description: garage.description || "",
      phone: garage.phone || "",
      whatsappNo: garage.whatsappNo || garage.phone || "",
      email: garage.email || "",
      address: garage.address || "",
      city: garage.city || "",
      area: garage.area || "",
      workingRadiusKm: garage.workingRadiusKm || 15,
      garageType: garage.garageType || "MULTI_BRAND",
      supportedBrands: getSupportedBrands(garage),
    });
  }, [garage, editingDetails]);

  const activation = garage?.activation || {};
  const uploadedImages = Array.isArray(garage?.images) ? garage.images : [];
  const supportedBrands = getSupportedBrands(garage);

  const minimumBalance = activation.minimumBalance || 1;
  const balance =
    activation.walletBalance ||
    garage?.walletBalance ||
    garage?.wallet?.balance ||
    0;

  const selectedBrandSet = useMemo(
    () => new Set(form.supportedBrands.map((item) => String(item))),
    [form.supportedBrands]
  );

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleBrand = (brandName) => {
    setForm((current) => {
      const exists = current.supportedBrands.includes(brandName);

      const nextBrands = exists
        ? current.supportedBrands.filter((item) => item !== brandName)
        : current.garageType === "AUTHORIZED"
          ? [brandName]
          : [...current.supportedBrands, brandName];

      return { ...current, supportedBrands: nextBrands };
    });
  };

  const saveDetails = async (event) => {
    event.preventDefault();
    setSaving("details");
    setError("");
    setSuccess("");

    try {
      await garageApi.updateProfile(garageToken, {
        ...form,
        supportedBrands: form.supportedBrands,
      });

      await refreshGarage(garageToken);
      setEditingDetails(false);
      setSuccess("Garage profile updated.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update garage profile");
    } finally {
      setSaving("");
    }
  };

  const savePhotos = async () => {
    setSaving("photos");
    setError("");
    setSuccess("");

    try {
      await garageApi.uploadPhotos(garageToken, garage.id, photoFiles);
      await refreshGarage(garageToken);

      setPhotoFiles([]);
      setEditingPhotos(false);
      setSuccess("Garage photos updated.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update garage photos");
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Profile</h1>
          <p className="mt-1 text-sm text-muted">
            Manage your garage information and listing status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditingDetails(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark"
        >
          <FiEdit2 />
          Edit Profile
        </button>
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

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-3xl font-bold text-ink">
            {garage?.name?.[0] || "G"}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-bold text-ink">
                  {garage?.name || "Garage"}
                </h2>

                <p className="mt-1 text-sm text-muted">
                  Owned by{" "}
                  {garage?.ownerName || garage?.owner?.name || "Garage owner"}
                </p>
              </div>

              <span
                className={[
                  "w-fit rounded-full px-3 py-1 text-xs font-bold",
                  garage?.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700",
                ].join(" ")}
              >
                {garage?.isActive ? "Active" : "Activation pending"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
              <p className="flex min-w-0 items-center gap-2 text-muted">
                <FiMapPin className="shrink-0" />
                <span className="truncate">
                  {garage?.address || "Address not available"}
                </span>
              </p>

              <p className="flex min-w-0 items-center gap-2 text-muted">
                <FiPhone className="shrink-0" />
                <span>{garage?.phone || "Phone not available"}</span>
              </p>

              <p className="flex min-w-0 items-center gap-2 text-muted">
                <FiMail className="shrink-0" />
                <span className="truncate">
                  {garage?.email || "Email not available"}
                </span>
              </p>

              <p className="flex min-w-0 items-center gap-2 text-muted">
                <FiImage className="shrink-0" />
                <span>{uploadedImages.length} uploaded photos</span>
              </p>
            </div>

            <div className="mt-5">
              <p className="text-sm font-bold text-ink">
                {garage?.garageType === "AUTHORIZED"
                  ? "Authorized brands"
                  : "Brands serviced"}
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {supportedBrands.length > 0 ? (
                  supportedBrands.map((brand) => (
                    <span
                      key={brand}
                      className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-ink"
                    >
                      {brand}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted">
                    No brands selected
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Garage Photos",
            value: `${uploadedImages.length} uploaded`,
            active: uploadedImages.length > 0,
          },
          {
            title: "Wallet Balance",
            value: `Rs. ${Number(balance).toLocaleString()} / Rs. ${Number(
              minimumBalance
            ).toLocaleString()}`,
            active: balance >= minimumBalance,
          },
          {
            title: "Customer Visibility",
            value: garage?.isActive
              ? "Garage is visible"
              : "Maintain required wallet balance",
            active: garage?.isActive,
          },
        ].map((item) => (
          <div
            key={item.title}
            className="card-soft rounded-2xl p-4 shadow-sm transition hover:shadow-md"
          >
            <div
              className={[
                "flex h-10 w-10 items-center justify-center rounded-xl",
                item.active
                  ? "bg-green-100 text-green-700"
                  : "bg-bg-soft text-muted",
              ].join(" ")}
            >
              <FiCheckCircle />
            </div>

            <h3 className="mt-3 font-bold text-ink">{item.title}</h3>
            <p className="mt-1 text-sm text-muted">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-ink">Current Photos</h3>
            <p className="mt-1 text-sm text-muted">
              Photos visible on your garage listing.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setEditingPhotos(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
          >
            <FiImage />
            Change Photos
          </button>
        </div>

        {uploadedImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {uploadedImages.map((image, index) => (
              <img
                key={image.id || getGarageImageUrl(image) || index}
                src={getGarageImageUrl(image)}
                alt="Garage"
                className="aspect-square rounded-xl object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-bg-soft p-5 text-sm text-muted">
            No garage photos uploaded yet.
          </div>
        )}
      </section>

      {editingDetails && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4 py-6">
          <form
            onSubmit={saveDetails}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">
                  Edit Garage Profile
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Update public garage details.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingDetails(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-line transition hover:border-ink hover:bg-bg-soft"
              >
                <FiX />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                placeholder="Garage name"
                className={inputClass}
                required
              />

              <input
                value={form.phone}
                onChange={(event) => setField("phone", event.target.value)}
                placeholder="Phone number"
                className={inputClass}
                required
              />

              <input
                value={form.whatsappNo}
                onChange={(event) =>
                  setField("whatsappNo", event.target.value)
                }
                placeholder="WhatsApp number"
                className={inputClass}
              />

              <input
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
                placeholder="Email"
                type="email"
                className={inputClass}
              />
            </div>

            <textarea
              value={form.description}
              onChange={(event) => setField("description", event.target.value)}
              placeholder="Garage description"
              rows={3}
              className={`${textareaClass} mt-3`}
            />

            <div className="mt-3 rounded-2xl border border-line p-4">
              <h3 className="font-bold text-ink">Location</h3>
              <p className="mb-3 text-sm text-muted">
                Saving address changes will refresh garage coordinates.
              </p>

              <textarea
                value={form.address}
                onChange={(event) => setField("address", event.target.value)}
                placeholder="Full address"
                rows={3}
                className={textareaClass}
                required
              />

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="grid gap-1.5 text-sm font-semibold text-ink">
                  City
                  <CitySelect
                    value={form.city}
                    onChange={(city) => setField("city", city)}
                    required
                    className={inputClass}
                  />
                </label>

                <label className="grid gap-1.5 text-sm font-semibold text-ink">
                  Area
                  <input
                    value={form.area}
                    onChange={(event) => setField("area", event.target.value)}
                    placeholder="Area"
                    className={inputClass}
                    required
                  />
                </label>

                <label className="grid gap-1.5 text-sm font-semibold text-ink">
                  Radius km
                  <input
                    value={form.workingRadiusKm}
                    onChange={(event) =>
                      setField("workingRadiusKm", Number(event.target.value))
                    }
                    placeholder="Radius in km"
                    type="number"
                    min="1"
                    max="100"
                    className={inputClass}
                  />
                </label>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-line p-4">
              <h3 className="font-bold text-ink">Brands Catered</h3>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {["MULTI_BRAND", "AUTHORIZED"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        garageType: type,
                        supportedBrands:
                          type === "AUTHORIZED"
                            ? current.supportedBrands.slice(0, 1)
                            : current.supportedBrands,
                      }))
                    }
                    className={[
                      "rounded-lg border px-4 py-2.5 text-left text-sm font-bold transition",
                      form.garageType === type
                        ? "border-brand bg-brand-soft text-ink"
                        : "border-line text-muted hover:border-ink",
                    ].join(" ")}
                  >
                    {type === "MULTI_BRAND" ? "Multi-brand" : "Authorized"}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {vehicleBrands.map((brand) => (
                  <button
                    key={brand.id || brand.name}
                    type="button"
                    onClick={() => toggleBrand(brand.name)}
                    className={[
                      "rounded-lg border p-3 text-center text-sm font-bold transition",
                      selectedBrandSet.has(brand.name)
                        ? "border-brand bg-brand-soft text-ink"
                        : "border-line text-muted hover:border-ink",
                    ].join(" ")}
                  >
                    {brand.logoUrl && (
                      <img
                        src={brand.logoUrl}
                        alt={brand.name}
                        className="mx-auto mb-2 h-8 w-12 object-contain"
                      />
                    )}
                    {brand.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving === "details"}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiSave />
              {saving === "details" ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>
      )}

      {editingPhotos && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">
                  Change Garage Photos
                </h2>

                <p className="mt-1 text-sm text-muted">
                  Upload a new set. This replaces the current photos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingPhotos(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-line transition hover:border-ink hover:bg-bg-soft"
              >
                <FiX />
              </button>
            </div>

            <ImageUpload
              min={1}
              max={15}
              maxSizeMb={1}
              value={photoFiles}
              onChange={setPhotoFiles}
            />

            <button
              type="button"
              onClick={savePhotos}
              disabled={saving === "photos" || photoFiles.length === 0}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiSave />
              {saving === "photos" ? "Uploading..." : "Save Photos"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}