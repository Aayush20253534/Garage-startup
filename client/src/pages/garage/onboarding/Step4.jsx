import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { garageApi } from "@/api/garage";
import api from "@/api/axios";

const getBrandLogo = (brand) =>
  brand.logoUrl || brand.image || brand.logo || brand.logo_url || "";

export default function OnboardingStep4({ data, onChange }) {
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(true);

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
      onChange({
        ...data,
        brands: data.brands.includes(brandName) ? [] : [brandName],
      });
      return;
    }

    const nextBrands = data.brands.includes(brandName)
      ? data.brands.filter((item) => item !== brandName)
      : [...data.brands, brandName];
    onChange({ ...data, brands: nextBrands });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      const fields = {
        ownerName: data.ownerName,
        email: data.email,
        phone: data.phone,
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
        workingRadiusKm: data.workingRadius,
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
            recharge ₹1000 or more to activate your listing.
          </p>
          <Link to="/garage/login" className="btn-primary w-full">
            Go to Garage Login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-soft">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl card-soft p-8"
        >
          <h1 className="text-3xl font-bold mb-2">Garage Type</h1>
          <p className="text-muted mb-8">
            Select your garage type and supported brands
          </p>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <FiAlertCircle />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => onChange({ ...data, garageType: "MULTI_BRAND" })}
                className={`p-6 rounded-2xl border-2 text-center transition-all ${
                  data.garageType === "MULTI_BRAND"
                    ? "border-brand bg-brand-soft"
                    : "border-line hover:border-ink-2"
                }`}
              >
                <h3 className="font-bold text-lg mb-1">Multi-Brand</h3>
                <p className="text-muted text-sm">We Service All Brands</p>
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
                className={`p-6 rounded-2xl border-2 text-center transition-all ${
                  data.garageType === "AUTHORIZED"
                    ? "border-brand bg-brand-soft"
                    : "border-line hover:border-ink-2"
                }`}
              >
                <h3 className="font-bold text-lg mb-1">Authorized</h3>
                <p className="text-muted text-sm">Select Specific Brands</p>
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">
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
                      className={`p-4 rounded-xl border-2 text-center transition-all flex flex-col items-center gap-2 ${
                        data.brands.includes(brand.name)
                          ? "border-brand bg-brand-soft"
                          : "border-line hover:border-ink-2"
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

            <button
              type="submit"
              disabled={loading || brandsLoading || data.brands.length === 0}
              className="btn-primary w-full py-4 text-lg"
            >
              {loading ? "Submitting..." : "Submit Application"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
