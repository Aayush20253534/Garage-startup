import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
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
  FiBriefcase,
  FiDollarSign,
  FiEye,
  FiTrash2,
} from "react-icons/fi";
import CitySelect from "@/components/common/CitySelect";
import ImageUpload from "@/components/garage/ImageUpload";
import CustomerLoginLoader from "@/components/auth/CustomerLoginLoader";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";
import { setGarage } from "@/store/garageSlice";
import {
  getGarageImageDeliveryUrl,
  normalizeMediaCollection,
  resolveMediaUrl,
} from "@/utils/mediaUrl";

const INDIA_PHONE_REGEX = /^\+91[6-9]\d{9}$/;

const normalizeIndianPhone = (value = "") => {
  let digits = String(value).replace(/\D/g, "");

  if (digits.startsWith("0091")) {
    digits = digits.slice(4);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.length === 10 ? `+91${digits}` : "";
};

const areSameIndianPhone = (left, right) => {
  const normalizedLeft = normalizeIndianPhone(left);
  const normalizedRight = normalizeIndianPhone(right);

  return Boolean(normalizedLeft && normalizedLeft === normalizedRight);
};

// Enhanced modern inputs with focus rings and smooth transitions
const inputClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none transition-all duration-200 focus:border-ink focus:ring-2 focus:ring-ink/5 placeholder:text-muted/60";

const textareaClass =
  "w-full resize-none rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none transition-all duration-200 focus:border-ink focus:ring-2 focus:ring-ink/5 placeholder:text-muted/60";

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

const getGarageImageUrl = (image) => resolveMediaUrl(image);

const PHOTO_RETRY_DELAYS_MS = [800, 2000, 5000];
const MAX_GARAGE_PHOTOS = 15;

const withImageRetryToken = (imageUrl, token) => {
  if (!imageUrl || !token) return imageUrl;

  try {
    const retryUrl = new URL(imageUrl, window.location.origin);
    retryUrl.searchParams.set("rovauto_image_retry", token);
    return retryUrl.href;
  } catch {
    return imageUrl;
  }
};

function GaragePhoto({ image, index, onDelete, deleting = false }) {
  const directImageUrl = getGarageImageUrl(image);
  const deliveryImageUrl = getGarageImageDeliveryUrl(image);
  const sourceUrls = useMemo(
    () => [...new Set([directImageUrl, deliveryImageUrl].filter(Boolean))],
    [deliveryImageUrl, directImageUrl],
  );
  const sourceKey = sourceUrls.join("|");
  const retryTimerRef = useRef(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [retryRound, setRetryRound] = useState(0);
  const [retryToken, setRetryToken] = useState("");
  const [waitingForRetry, setWaitingForRetry] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    setSourceIndex(0);
    setRetryRound(0);
    setRetryToken("");
    setWaitingForRetry(false);
    setFailed(false);

    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, [sourceKey]);

  const currentUrl = sourceUrls[sourceIndex] || "";
  const imageSrc = withImageRetryToken(currentUrl, retryToken);
  const openUrl = directImageUrl || deliveryImageUrl;

  const handleLoad = () => {
    setWaitingForRetry(false);
    setFailed(false);
  };

  const handleError = () => {
    if (sourceIndex < sourceUrls.length - 1) {
      setSourceIndex((current) => current + 1);
      return;
    }

    if (retryRound < PHOTO_RETRY_DELAYS_MS.length) {
      const nextRound = retryRound + 1;
      const delay = PHOTO_RETRY_DELAYS_MS[retryRound];

      setWaitingForRetry(true);
      retryTimerRef.current = window.setTimeout(() => {
        setSourceIndex(0);
        setRetryRound(nextRound);
        setRetryToken(`${nextRound}-${Date.now()}`);
        setWaitingForRetry(false);
      }, delay);
      return;
    }

    setFailed(true);
  };

  let photoContent;

  if (!imageSrc || failed) {
    photoContent = (
      <div className="grid h-full w-full place-items-center border border-dashed border-line bg-bg-soft p-4 text-center text-xs font-semibold text-muted/80">
        Photo unavailable
      </div>
    );
  } else if (waitingForRetry) {
    photoContent = (
      <div className="grid h-full w-full animate-pulse place-items-center border border-line bg-bg-soft/60 p-4 text-center text-xs font-semibold text-muted/80">
        Loading photo...
      </div>
    );
  } else {
    photoContent = (
      <a
        href={openUrl}
        target="_blank"
        rel="noreferrer"
        className="group block h-full w-full bg-bg-soft"
        aria-label={`Open garage photo ${index + 1}`}
      >
        <img
          key={imageSrc}
          src={imageSrc}
          alt={`Garage photo ${index + 1}`}
          loading={index < 5 ? "eager" : "lazy"}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-ink/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </a>
    );
  }

  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-bg-soft shadow-sm transition-all duration-300 hover:border-ink/30 hover:shadow-md">
      {photoContent}

      {onDelete && image?.id && (
        <button
          type="button"
          onClick={() => onDelete(image)}
          disabled={deleting}
          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/75 text-white shadow-md transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Delete garage photo ${index + 1}`}
          title="Delete this photo"
        >
          {deleting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <FiTrash2 className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}
export default function GarageProfile() {
  const dispatch = useDispatch();
  const { garage } = useSelector((state) => state.garage);
  const { garageToken, refreshGarage, fetchVehicleMeta } = useApp();

  const [editingDetails, setEditingDetails] = useState(false);
  const [editingPhotos, setEditingPhotos] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [vehicleBrands, setVehicleBrands] = useState([]);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [deletingPhotoId, setDeletingPhotoId] = useState("");

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
    fulfillmentMode: "BOTH",
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
      fulfillmentMode:
        garage.fulfillmentMode === "SELF_DROP_OFF" ? "SELF_DROP_OFF" : "BOTH",
      supportedBrands: getSupportedBrands(garage),
    });
  }, [garage, editingDetails]);

  const activation = garage?.activation || {};
  const uploadedImages = useMemo(
    () => normalizeMediaCollection(garage?.images),
    [garage?.images],
  );
  const supportedBrands = getSupportedBrands(garage);
  const remainingPhotoSlots = Math.max(
    0,
    MAX_GARAGE_PHOTOS - uploadedImages.length,
  );

  const minimumActivationAmount =
    activation.minimumActivationAmount || activation.minimumBalance || 100;
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

  const updateGaragePhone = (value) => {
    setForm((current) => {
      const whatsappFollowsGaragePhone =
        !current.whatsappNo ||
        current.whatsappNo === current.phone ||
        areSameIndianPhone(current.whatsappNo, current.phone);

      return {
        ...current,
        phone: value,
        whatsappNo: whatsappFollowsGaragePhone
          ? value
          : current.whatsappNo,
      };
    });
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
      const phone = normalizeIndianPhone(form.phone);
      const whatsappNo = form.whatsappNo.trim()
        ? normalizeIndianPhone(form.whatsappNo)
        : "";

      if (!INDIA_PHONE_REGEX.test(phone)) {
        setError(
          "Enter a valid 10-digit Indian garage phone number starting with 6, 7, 8 or 9.",
        );
        return;
      }

      if (form.whatsappNo.trim() && !INDIA_PHONE_REGEX.test(whatsappNo)) {
        setError(
          "Enter a valid 10-digit Indian WhatsApp number starting with 6, 7, 8 or 9.",
        );
        return;
      }

      setForm((current) => ({
        ...current,
        phone,
        whatsappNo: whatsappNo || "",
      }));

      await garageApi.updateProfile(garageToken, {
        ...form,
        phone,
        whatsappNo: whatsappNo || null,
        supportedBrands: form.supportedBrands,
      });

      await refreshGarage(garageToken);
      setEditingDetails(false);
      setSuccess("Garage profile updated successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update garage profile");
    } finally {
      setSaving("");
    }
  };

  const applyGarageMediaUpdate = async (updatedGarage) => {
    const optimisticGarage = {
      ...garage,
      ...updatedGarage,
      activation: {
        ...(garage?.activation || {}),
        ...(updatedGarage?.activation || {}),
      },
      images: updatedGarage?.images || [],
      wallet: updatedGarage?.wallet || garage?.wallet,
    };

    localStorage.setItem("garage", JSON.stringify(optimisticGarage));
    dispatch(setGarage(optimisticGarage));
    await refreshGarage({ force: true });
  };

  const openPhotoEditor = () => {
    setPhotoFiles([]);
    setError("");
    setSuccess("");
    setEditingPhotos(true);
  };

  const savePhotos = async () => {
    if (photoFiles.length === 0) return;

    setSaving("photos");
    setError("");
    setSuccess("");

    try {
      const uploadedCount = photoFiles.length;
      const uploadedGarage = await garageApi.uploadPhotos(
        garageToken,
        garage.id,
        photoFiles,
      );

      await applyGarageMediaUpdate(uploadedGarage);
      setPhotoFiles([]);
      setEditingPhotos(false);
      setSuccess(
        `${uploadedCount} garage photo${uploadedCount === 1 ? "" : "s"} added successfully.`,
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to add garage photos");
    } finally {
      setSaving("");
    }
  };

  const deletePhoto = async (image) => {
    if (!image?.id || String(image.id).startsWith("media-")) {
      setError("This photo cannot be deleted because its media record is missing.");
      return;
    }

    const confirmed = window.confirm(
      "Delete this garage photo? This cannot be undone.",
    );

    if (!confirmed) return;

    setDeletingPhotoId(image.id);
    setError("");
    setSuccess("");

    try {
      const updatedGarage = await garageApi.deletePhoto(
        garageToken,
        garage.id,
        image.id,
      );

      await applyGarageMediaUpdate(updatedGarage);
      setSuccess("Garage photo deleted successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete garage photo");
    } finally {
      setDeletingPhotoId("");
    }
  };

  return (
    <>
      <CustomerLoginLoader
        visible={saving === "photos"}
        eyebrow="GARAGE GALLERY"
        title="Uploading garage photos"
        message="Optimizing and securing your images before publishing them."
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-2 overflow-x-hidden antialiased">
      {/* Premium Header Layout */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Profile Settings</h1>
          <p className="mt-1.5 text-sm text-muted">
            Manage your garage digital storefront, core configurations, and operational status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditingDetails(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-black transition-all duration-200 hover:bg-brand-dark active:scale-[0.98] shadow-sm shadow-brand/10"
        >
          <FiEdit2 className="w-4 h-4" />
          Edit Profile
        </button>
      </div>

      {/* Global Toast Alerts */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-800 backdrop-blur-sm animate-fadeIn">
          <FiAlertCircle className="shrink-0 mt-0.5 w-4 h-4 text-red-600" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50/60 p-4 text-sm text-green-800 backdrop-blur-sm animate-fadeIn">
          <FiCheckCircle className="shrink-0 mt-0.5 w-4 h-4 text-green-600" />
          <span className="font-medium">{success}</span>
        </div>
      )}

      {/* Main Corporate Workspace Summary Card */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-sm transition-all hover:shadow-md">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {/* Enhanced Avatar Unit */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-3xl font-black text-ink shadow-inner border border-brand/10">
            {garage?.name?.[0] || "G"}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  {garage?.name || "Garage"}
                </h2>
                <p className="mt-1 text-sm text-muted font-medium">
                  Owned by{" "}
                  <span className="text-ink font-semibold">
                    {garage?.ownerName || garage?.owner?.name || "Garage owner"}
                  </span>
                </p>
              </div>

              <span
                className={[
                  "inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-wide",
                  garage?.isActive
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-amber-50 border-amber-200 text-amber-700",
                ].join(" ")}
              >
                <span className={["h-2 w-2 rounded-sm", garage?.isActive ? "bg-green-500" : "bg-amber-500 animate-pulse"].join(" ")} />
                {garage?.isActive ? "Active" : "Activation Pending"}
              </span>
            </div>

            {/* Structured Clean Meta Details Grid */}
            <div className="mt-6 grid gap-x-6 gap-y-3.5 text-sm sm:grid-cols-2 border-t border-line/60 pt-5">
              <p className="flex min-w-0 items-center gap-3 text-muted">
                <FiMapPin className="shrink-0 text-ink/40 w-4 h-4" />
                <span className="truncate font-medium text-ink/80">
                  {garage?.address || "Address not available"}
                </span>
              </p>

              <p className="flex min-w-0 items-center gap-3 text-muted">
                <FiPhone className="shrink-0 text-ink/40 w-4 h-4" />
                <span className="font-medium text-ink/80">{garage?.phone || "Phone not available"}</span>
              </p>

              <p className="flex min-w-0 items-center gap-3 text-muted">
                <FiMail className="shrink-0 text-ink/40 w-4 h-4" />
                <span className="truncate font-medium text-ink/80">
                  {garage?.email || "Email not available"}
                </span>
              </p>

              <p className="flex min-w-0 items-center gap-3 text-muted">
                <FiImage className="shrink-0 text-ink/40 w-4 h-4" />
                <span className="font-medium text-ink/80">{uploadedImages.length} verified photos uploaded</span>
              </p>

              <p className="flex min-w-0 items-center gap-3 text-muted">
                <FiBriefcase className="shrink-0 text-ink/40 w-4 h-4" />
                <span className="font-medium text-ink/80">
                  Booking handover: {garage?.fulfillmentMode === "SELF_DROP_OFF"
                    ? "Self drop only"
                    : "Pickup + self drop"}
                </span>
              </p>
            </div>

            {/* Segmented Brand Catalog Section */}
            <div className="mt-6 border-t border-line/60 pt-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                {garage?.garageType === "AUTHORIZED" ? "Authorized Brands Portfolio" : "Brands Serviced Capabilities"}
              </p>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {supportedBrands.length > 0 ? (
                  supportedBrands.map((brand) => (
                    <span
                      key={brand}
                      className="rounded-lg bg-bg-soft border border-line/70 px-3 py-1 text-xs font-semibold text-ink shadow-sm"
                    >
                      {brand}
                    </span>
                  ))
                ) : (
                  <span className="text-xs italic text-muted/80">
                    No selective brands configured.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Corporate Dashboard KPI Matrix Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Garage Gallery Status",
            value: `${uploadedImages.length} Assets Active`,
            active: uploadedImages.length > 0,
            icon: <FiBriefcase className="w-4 h-4" />,
          },
          {
            title: "Available Wallet Balance",
            value: `Rs. ${Number(balance).toLocaleString()}`,
            active: garage?.isActive || balance >= minimumActivationAmount,
            icon: <FiDollarSign className="w-4 h-4" />,
          },
          {
            title: "Discovery & Visibility",
            value: garage?.isActive
              ? "Live to Customers"
              : `Minimum recharge Rs. ${Number(minimumActivationAmount).toLocaleString()} needed`,
            active: garage?.isActive,
            icon: <FiEye className="w-4 h-4" />,
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-line bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            <div
              className={[
                "flex h-9 w-9 items-center justify-center rounded-xl border",
                item.active
                  ? "bg-green-50 border-green-200 text-green-600"
                  : "bg-bg-soft border-line text-muted",
              ].join(" ")}
            >
              {item.icon}
            </div>

            <h3 className="mt-3.5 font-bold tracking-tight text-ink text-sm">{item.title}</h3>
            <p className="mt-1 text-xs font-medium text-muted">{item.value}</p>
          </div>
        ))}
      </section>

      {/* Premium Standalone Visual Media Manager Canvas */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-ink">Active Visual Gallery</h3>
            <p className="mt-1 text-xs text-muted font-medium">
              High-resolution storefront media displayed prominently across consumer channels.
            </p>
          </div>

          <button
            type="button"
            onClick={openPhotoEditor}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-xs font-bold text-ink transition-all duration-200 hover:border-ink hover:bg-bg-soft active:scale-98 shadow-xs"
          >
            <FiImage className="w-3.5 h-3.5 text-muted" />
            Modify Showcase Images
          </button>
        </div>

        {uploadedImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {uploadedImages.map((image, index) => (
              <GaragePhoto
                key={image.id || getGarageImageUrl(image) || index}
                image={image}
                index={index}
                onDelete={deletePhoto}
                deleting={deletingPhotoId === image.id}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line bg-bg-soft/50 p-6 text-center text-sm font-medium text-muted">
            No profile photos uploaded yet. Complete your gallery to scale discovery metrics.
          </div>
        )}
      </section>

      {/* Contextual Full-Screen Premium Blur Modals */}
      {editingDetails && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={saveDetails}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl border border-line animate-slideUp"
          >
            {/* Modal Navigation Top-Bar */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-white/95 px-6 py-4 backdrop-blur-md">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink">Update Garage Specifications</h2>
                <p className="text-xs text-muted font-medium">Ensure configurations align with verified commercial documents.</p>
              </div>

              <button
                type="button"
                onClick={() => setEditingDetails(false)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-line transition-all hover:border-ink hover:bg-bg-soft text-muted hover:text-ink"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Dynamic Field Matrices */}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                  Garage Enterprise Name
                  <input
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    placeholder="e.g., Apex Automotive Works"
                    className={inputClass}
                    required
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                  Primary Mobile Channel
                  <input
                    value={form.phone}
                    onChange={(event) => updateGaragePhone(event.target.value)}
                    onBlur={() => {
                      const normalized = normalizeIndianPhone(form.phone);
                      if (normalized) updateGaragePhone(normalized);
                    }}
                    placeholder="e.g., 9812345678"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={18}
                    className={inputClass}
                    required
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                  Official WhatsApp Contact
                  <input
                    value={form.whatsappNo}
                    onChange={(event) => setField("whatsappNo", event.target.value)}
                    onBlur={() => {
                      const normalized = normalizeIndianPhone(form.whatsappNo);
                      if (normalized) setField("whatsappNo", normalized);
                    }}
                    placeholder="e.g., 9812345678"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={18}
                    className={inputClass}
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                  Enterprise Communication Email
                  <input
                    value={form.email}
                    onChange={(event) => setField("email", event.target.value)}
                    placeholder="e.g., contact@apexauto.com"
                    type="email"
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                Corporate Description / Bio
                <textarea
                  value={form.description}
                  onChange={(event) => setField("description", event.target.value)}
                  placeholder="Provide details about certifications, service excellence, specializations, etc..."
                  rows={3}
                  className={textareaClass}
                />
              </label>

              {/* Geographic Parameter Panel */}
              <div className="rounded-xl border border-line bg-bg-soft/40 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-ink">Geographic Location Configurations</h3>
                  <p className="text-xs text-muted">Physical base adjustments dynamically synchronize geospatial visibility matrices.</p>
                </div>

                <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                  Full Physical Street Address
                  <textarea
                    value={form.address}
                    onChange={(event) => setField("address", event.target.value)}
                    placeholder="Complete corporate address location mapping details..."
                    rows={2}
                    className={textareaClass}
                    required
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                    City Center Hub
                    <CitySelect
                      value={form.city}
                      onChange={(city) => setField("city", city)}
                      required
                      className={inputClass}
                    />
                  </label>

                  <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                    Sub-District / Area Zone
                    <input
                      value={form.area}
                      onChange={(event) => setField("area", event.target.value)}
                      placeholder="e.g., Silicon District"
                      className={inputClass}
                      required
                    />
                  </label>

                  <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                    Operational Radius Limit
                    <div className="relative flex items-center">
                      <input
                        value={form.workingRadiusKm}
                        onChange={(event) => setField("workingRadiusKm", Number(event.target.value))}
                        placeholder="15"
                        type="number"
                        min="1"
                        max="100"
                        className={`${inputClass} pr-10`}
                      />
                      <span className="absolute right-3 text-xs font-semibold text-muted">KM</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Industrial Brand Portfolio Selection Grid */}
              <div className="rounded-xl border border-line bg-bg-soft/40 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-ink">Operational Strategy Selection</h3>
                  <p className="text-xs text-muted">Select categorization depending on authorized franchising architectures.</p>
                </div>

                <div className="grid gap-3 grid-cols-2">
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
                        "rounded-xl border px-4 py-3 text-center text-sm font-bold transition-all duration-200 shadow-xs",
                        form.garageType === type
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-white text-muted hover:border-ink/50 hover:text-ink",
                      ].join(" ")}
                    >
                      {type === "MULTI_BRAND" ? "Multi-Brand Workshop" : "Authorized Single Hub"}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 border-t border-line/70 pt-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">Customer vehicle handover</p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      This controls which new booking requests your garage can receive. Existing accepted bookings are not changed.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        value: "BOTH",
                        title: "Pickup + self drop",
                        description: "Receive pickup bookings and customers who bring the vehicle to the garage.",
                      },
                      {
                        value: "SELF_DROP_OFF",
                        title: "Self drop only",
                        description: "Do not receive pickup requests. Customers must bring the vehicle to the garage.",
                      },
                    ].map((option) => {
                      const selected = form.fulfillmentMode === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setField("fulfillmentMode", option.value)}
                          className={[
                            "min-w-0 rounded-xl border p-4 text-left transition-all duration-200",
                            selected
                              ? "border-ink bg-ink text-white shadow-sm"
                              : "border-line bg-white text-ink hover:border-ink/50",
                          ].join(" ")}
                          aria-pressed={selected}
                        >
                          <span className="block text-sm font-bold">{option.title}</span>
                          <span
                            className={[
                              "mt-1.5 block text-xs leading-5",
                              selected ? "text-white/75" : "text-muted",
                            ].join(" ")}
                          >
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Select Enterprise Capabilities</p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 max-h-[220px] overflow-y-auto pr-1">
                    {vehicleBrands.map((brand) => {
                      const isSelected = selectedBrandSet.has(brand.name);
                      return (
                        <button
                          key={brand.id || brand.name}
                          type="button"
                          onClick={() => toggleBrand(brand.name)}
                          className={[
                            "flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all duration-200 bg-white shadow-xs min-h-[84px]",
                            isSelected
                              ? "border-brand bg-brand-soft/40 ring-1 ring-brand text-ink"
                              : "border-line text-muted hover:border-ink/40 hover:text-ink",
                          ].join(" ")}
                        >
                          {brand.logoUrl && (
                            <img
                              src={brand.logoUrl}
                              alt={brand.name}
                              className="mb-2 h-7 w-12 object-contain filter contrast-125 brightness-95"
                            />
                          )}
                          <span className="text-xs font-bold leading-tight tracking-tight">{brand.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Commit Action Panel */}
            <div className="sticky bottom-0 border-t border-line bg-bg-soft p-4 px-6 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving === "details"}
                className="inline-flex h-11 w-full sm:w-auto min-w-[160px] items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-black transition-all duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
              >
                <FiSave className="w-4 h-4" />
                {saving === "details" ? "Synchronizing..." : "Save Configuration"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Showcase Image Upload Management Layer Modal */}
      {editingPhotos && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl animate-slideUp">
            <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-line bg-white/95 px-6 py-4 backdrop-blur-md">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink">Manage Garage Photos</h2>
                <p className="text-xs font-medium text-muted">
                  Add only the missing photos or delete individual photos. Existing photos stay untouched.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPhotoFiles([]);
                  setEditingPhotos(false);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition-all hover:border-ink hover:bg-bg-soft hover:text-ink"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <section>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-ink">Current gallery</h3>
                    <p className="mt-0.5 text-xs font-medium text-muted">
                      {uploadedImages.length} of {MAX_GARAGE_PHOTOS} photo slots used
                    </p>
                  </div>
                  <span className="rounded-full border border-line bg-bg-soft px-3 py-1 text-xs font-bold text-ink">
                    {remainingPhotoSlots} remaining
                  </span>
                </div>

                {uploadedImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {uploadedImages.map((image, index) => (
                      <GaragePhoto
                        key={image.id || getGarageImageUrl(image) || index}
                        image={image}
                        index={index}
                        onDelete={deletePhoto}
                        deleting={deletingPhotoId === image.id}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-line bg-bg-soft/40 p-5 text-center text-sm font-medium text-muted">
                    No garage photos uploaded yet.
                  </div>
                )}
              </section>

              <section className="border-t border-line pt-5">
                <h3 className="text-sm font-bold text-ink">Add new photos</h3>
                <p className="mb-3 mt-1 text-xs font-medium text-muted">
                  New photos are appended to the existing gallery. The maximum remains {MAX_GARAGE_PHOTOS}.
                </p>

                {remainingPhotoSlots > 0 ? (
                  <div className="rounded-xl border border-line bg-bg-soft/30 p-1">
                    <ImageUpload
                      min={0}
                      max={remainingPhotoSlots}
                      maxSizeMb={2}
                      countOffset={uploadedImages.length}
                      totalMax={MAX_GARAGE_PHOTOS}
                      value={photoFiles}
                      onChange={setPhotoFiles}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                    The gallery already has {MAX_GARAGE_PHOTOS} photos. Delete one above before adding another.
                  </div>
                )}
              </section>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end border-t border-line bg-bg-soft/95 p-4 px-6 backdrop-blur-md">
              <button
                type="button"
                onClick={savePhotos}
                disabled={saving === "photos" || photoFiles.length === 0}
                className="inline-flex h-11 w-full min-w-[170px] items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-black shadow-sm transition-all duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <FiSave className="h-4 w-4" />
                {saving === "photos"
                  ? "Adding Photos..."
                  : photoFiles.length > 0
                    ? `Add ${photoFiles.length} Photo${photoFiles.length === 1 ? "" : "s"}`
                    : "Select Photos to Add"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
