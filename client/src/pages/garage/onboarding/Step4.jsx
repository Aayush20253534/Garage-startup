import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiAlertCircle, FiArrowLeft, FiCheckCircle } from "react-icons/fi";
import { garageApi } from "@/api/garage";
import api from "@/api/axios";
import CustomerLoginLoader from "@/components/auth/CustomerLoginLoader";

const getBrandLogo = (brand) =>
  brand.logoUrl || brand.image || brand.logo || brand.logo_url || "";

const getPhoneDigits = (value) => {
  let digits = value.replace(/\D/g, "");

  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 10);
};

export default function OnboardingStep4({ data, onChange, onBack }) {
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const actionSectionRef = useRef(null);

  useEffect(() => {
    const loadBrands = async () => {
      try {
        setBrandsLoading(true);
        const res = await api.get("/vehicle-meta/brands");
        setBrands(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        setError(
          err.response?.data?.message || "Unable to load vehicle brands",
        );
        setBrands([]);
      } finally {
        setBrandsLoading(false);
      }
    };

    loadBrands();
  }, []);

  const toggleBrand = (brandName) => {
    if (data.garageType === "AUTHORIZED") {
      const isSelecting = !data.brands.includes(brandName);
      onChange({
        ...data,
        brands: isSelecting ? [brandName] : [],
      });

      if (isSelecting && window.matchMedia("(max-width: 639px)").matches) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            actionSectionRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          });
        });
      }
      return;
    }

    const nextBrands = data.brands.includes(brandName)
      ? data.brands.filter((item) => item !== brandName)
      : [...data.brands, brandName];
    onChange({ ...data, brands: nextBrands });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setError("You must accept the Garage Partner Terms & Conditions");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      const phoneDigits = getPhoneDigits(data.phone);
      const fields = {
        ownerName: data.ownerName,
        email: data.email,
        phone: phoneDigits ? `+91${phoneDigits}` : "",
        garageName: data.name,
        description: [
          data.description,
          data.garageType ? `Garage type: ${data.garageType}` : "",
          data.brands.length ? `Brands: ${data.brands.join(", ")}` : "",
          data.gst ? `GST: ${data.gst}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        address: data.address,
        city: data.city,
        area: data.area,
        latitude: data.location?.lat,
        longitude: data.location?.lng,
        placeId: data.placeId || null,
        workingRadiusKm: data.workingRadius,
        acceptedTerms: "true",
      };

      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          formData.append(key, value);
        }
      });
      data.images.forEach((image) => {
        if (image.file) formData.append("images", image.file);
      });

      await garageApi.submitApplication(formData);
      setComplete(true);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to submit application");
    } finally {
      setLoading(false);
    }
  };

  if (complete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-soft px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="card-soft max-w-xl p-8 text-center"
        >
          <FiCheckCircle className="w-20 h-20 mx-auto text-brand mb-6" />
          <h1 className="text-4xl font-bold mb-4">Application Submitted</h1>
          <p className="text-muted text-lg mb-6">
            Your garage application is pending admin review. After approval,
            recharge Rs. 100 or more to activate your listing.
          </p>
          <Link
            to="/garage/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark"
          >
            Go to Garage Login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <CustomerLoginLoader
        visible={loading}
        eyebrow="GARAGE APPLICATION"
        title="Submitting your garage"
        message="Uploading your details and photos for secure review."
      />
      <div className="min-h-screen flex flex-col bg-bg-soft">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-soft w-full max-w-2xl p-5 sm:p-8"
        >
          <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Garage Type</h1>
          <p className="mb-6 text-sm text-muted sm:mb-8 sm:text-base">
            Select your garage type and supported brands
          </p>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <FiAlertCircle />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => onChange({ ...data, garageType: "MULTI_BRAND" })}
                className={`min-w-0 overflow-hidden rounded-lg border px-3 py-4 text-center shadow-sm transition sm:p-5 ${
                  data.garageType === "MULTI_BRAND"
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-white hover:border-ink/25 hover:bg-bg-soft"
                }`}
              >
                <h3 className="mb-1 break-words text-base font-bold leading-tight sm:text-lg">
                  Multi-Brand
                </h3>
                <p className="text-xs leading-5 text-muted sm:text-sm">
                  We Service All Brands
                </p>
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...data,
                    garageType: "AUTHORIZED",
                    brands: data.brands.slice(0, 1),
                  })
                }
                className={`min-w-0 overflow-hidden rounded-lg border px-3 py-4 text-center shadow-sm transition sm:p-5 ${
                  data.garageType === "AUTHORIZED"
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-white hover:border-ink/25 hover:bg-bg-soft"
                }`}
              >
                <h3 className="mb-1 break-words text-base font-bold leading-tight sm:text-lg">
                  Authorized
                </h3>
                <p className="text-xs leading-5 text-muted sm:text-sm">
                  Select Specific Brands
                </p>
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="break-words text-base font-semibold leading-snug">
                {data.garageType === "AUTHORIZED"
                  ? "Select Authorized Brand"
                  : "Select Brands You Service"}
              </h4>
              {brandsLoading ? (
                <div className="rounded-xl border border-line bg-bg-soft p-4 text-sm text-muted">
                  Loading vehicle brands...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {brands.map((brand) => {
                  const Icon = brand.icon;
                  const logo = getBrandLogo(brand);
                  return (
                    <button
                      key={brand.id || brand.name}
                      type="button"
                      onClick={() => toggleBrand(brand.name)}
                      className={`flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center shadow-sm transition ${
                        data.brands.includes(brand.name)
                          ? "border-brand bg-brand-soft"
                          : "border-line bg-white hover:border-ink/25 hover:bg-bg-soft"
                      }`}
                    >
                      {logo ? (
                        <img
                          src={logo}
                          alt={brand.name}
                          className="mb-2 h-10 max-w-20 object-contain"
                        />
                      ) : Icon ? (
                        <Icon className="mb-2 h-10 w-auto" />
                      ) : (
                        <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-brand font-bold">
                          {brand.name.charAt(0)}
                        </div>
                      )}
                      <div className="text-sm font-semibold">{brand.name}</div>
                    </button>
                  );
                  })}
                </div>
              )}
            </div>

            <label ref={actionSectionRef} className="flex scroll-mt-4 cursor-pointer items-start gap-3 rounded-lg border border-line bg-white p-4 text-sm leading-6 text-ink">
              <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required className="mt-1 h-4 w-4 shrink-0 accent-brand" />
              <span>I have read and agree to the <Link to="/garage-partner-terms" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2 hover:text-brand-dark">Garage Partner Terms & Conditions</Link>.</span>
            </label>

            <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
              <button
                type="button"
                onClick={onBack}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="submit"
                disabled={loading || brandsLoading || data.brands.length === 0 || !acceptedTerms}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
      </div>
    </>
  );
}
