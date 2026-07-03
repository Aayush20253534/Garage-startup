import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
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
  const uploadedImages = garage?.images || [];
  const minimumBalance = activation.minimumBalance || 1000;
  const balance =
    activation.walletBalance ||
    garage?.walletBalance ||
    garage?.wallet?.balance ||
    0;

  const selectedBrandSet = useMemo(
    () => new Set(form.supportedBrands.map((item) => String(item))),
    [form.supportedBrands],
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted">
            Manage your garage information and listing status
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditingDetails(true)}
          className="btn-primary"
        >
          <FiEdit2 />
          Edit Profile
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="card-soft p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-3xl font-bold">
            {garage?.name?.[0] || "G"}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">
                  {garage?.name || "Garage"}
                </h2>
                <p className="text-muted">
                  Owned by{" "}
                  {garage?.ownerName || garage?.owner?.name || "Garage owner"}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  garage?.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {garage?.isActive ? "Active" : "Activation pending"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
              <p className="flex items-center gap-2">
                <FiMapPin className="text-muted" />
                {garage?.address || "Address not available"}
              </p>

              <p className="flex items-center gap-2">
                <FiPhone className="text-muted" />
                {garage?.phone || "Phone not available"}
              </p>

              <p className="flex items-center gap-2">
                <FiMail className="text-muted" />
                {garage?.email || "Email not available"}
              </p>

              <p className="flex items-center gap-2">
                <FiImage className="text-muted" />
                {uploadedImages.length} uploaded photos
              </p>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold">
                {garage?.garageType === "AUTHORIZED"
                  ? "Authorized brands"
                  : "Brands serviced"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {getSupportedBrands(garage).length > 0 ? (
                  getSupportedBrands(garage).map((brand) => (
                    <span key={brand} className="chip-brand">
                      {brand}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted">No brands selected</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-soft p-5">
          <FiCheckCircle
            className={
              uploadedImages.length > 0 ? "text-green-700" : "text-muted"
            }
          />
          <h3 className="mt-3 font-bold">Garage Photos</h3>
          <p className="text-sm text-muted">{uploadedImages.length} uploaded</p>
        </div>

        <div className="card-soft p-5">
          <FiCheckCircle
            className={
              balance >= minimumBalance ? "text-green-700" : "text-muted"
            }
          />
          <h3 className="mt-3 font-bold">Wallet Balance</h3>
          <p className="text-sm text-muted">
            Rs. {Number(balance).toLocaleString()} / Rs.{" "}
            {Number(minimumBalance).toLocaleString()}
          </p>
        </div>

        <div className="card-soft p-5">
          <FiCheckCircle
            className={garage?.isActive ? "text-green-700" : "text-muted"}
          />
          <h3 className="mt-3 font-bold">Customer Visibility</h3>
          <p className="text-sm text-muted">
            {garage?.isActive
              ? "Garage is visible"
              : "Maintain required wallet balance"}
          </p>
        </div>
      </div>

      <div className="card-soft p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold">Current Photos</h3>
          <button
            type="button"
            onClick={() => setEditingPhotos(true)}
            className="btn-ghost text-sm"
          >
            <FiImage />
            Change Photos
          </button>
        </div>

        {uploadedImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {uploadedImages.map((image, index) => (
              <img
                key={image.id || image.imageUrl || index}
                src={image.imageUrl}
                alt="Garage"
                className="aspect-square rounded-xl object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-bg-soft p-6 text-muted">
            No garage photos uploaded yet.
          </div>
        )}
      </div>

      {editingDetails && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4 py-6">
          <form
            onSubmit={saveDetails}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-soft"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">Edit Garage Profile</h2>
              <button
                type="button"
                onClick={() => setEditingDetails(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-line"
              >
                <FiX />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Garage name"
                className="rounded-xl border border-line px-4 py-3 focus:border-ink focus:outline-none"
                required
              />
              <input
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="Phone number"
                className="rounded-xl border border-line px-4 py-3 focus:border-ink focus:outline-none"
                required
              />
              <input
                value={form.whatsappNo}
                onChange={(e) => setField("whatsappNo", e.target.value)}
                placeholder="WhatsApp number"
                className="rounded-xl border border-line px-4 py-3 focus:border-ink focus:outline-none"
              />
              <input
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="Email"
                type="email"
                className="rounded-xl border border-line px-4 py-3 focus:border-ink focus:outline-none"
              />
            </div>

            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Garage description"
              rows={3}
              className="mt-4 w-full rounded-xl border border-line px-4 py-3 focus:border-ink focus:outline-none"
            />

            <div className="mt-4 rounded-2xl border border-line p-4">
              <h3 className="font-bold">Location</h3>
              <p className="mb-4 text-sm text-muted">
                Saving address changes will refresh garage coordinates.
              </p>
              <textarea
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
                placeholder="Full address"
                rows={3}
                className="w-full rounded-xl border border-line px-4 py-3 focus:border-ink focus:outline-none"
                required
              />
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="grid gap-2 text-sm font-semibold">
                  City
                  <CitySelect
                    value={form.city}
                    onChange={(city) => setField("city", city)}
                    required
                    className="rounded-xl border border-line px-4 py-3 font-normal focus:border-ink focus:outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Area
                  <input
                    value={form.area}
                    onChange={(e) => setField("area", e.target.value)}
                    placeholder="Area"
                    className="rounded-xl border border-line px-4 py-3 font-normal focus:border-ink focus:outline-none"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Working radius (km)
                  <input
                    value={form.workingRadiusKm}
                    onChange={(e) =>
                      setField("workingRadiusKm", Number(e.target.value))
                    }
                    placeholder="Radius in km"
                    type="number"
                    min="1"
                    max="100"
                    className="rounded-xl border border-line px-4 py-3 font-normal focus:border-ink focus:outline-none"
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-line p-4">
              <h3 className="font-bold">Brands Catered</h3>
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
                    className={`rounded-xl border px-4 py-3 text-left font-semibold ${
                      form.garageType === type
                        ? "border-brand bg-brand-soft"
                        : "border-line"
                    }`}
                  >
                    {type === "MULTI_BRAND" ? "Multi-brand" : "Authorized"}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {vehicleBrands.map((brand) => (
                  <button
                    key={brand.id || brand.name}
                    type="button"
                    onClick={() => toggleBrand(brand.name)}
                    className={`rounded-xl border p-3 text-center text-sm font-semibold ${
                      selectedBrandSet.has(brand.name)
                        ? "border-brand bg-brand-soft"
                        : "border-line hover:border-ink"
                    }`}
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
              className="btn-primary mt-5 w-full py-4"
            >
              <FiSave />
              {saving === "details" ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>
      )}

      {editingPhotos && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Change Garage Photos</h2>
                <p className="text-sm text-muted">
                  Upload a new set. This replaces the current photos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPhotos(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-line"
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
              className="btn-primary mt-5 w-full py-4"
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
