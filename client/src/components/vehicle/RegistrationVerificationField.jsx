import { useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiLoader, FiShield } from "react-icons/fi";
import api from "@/api/axios";

const normalizeRegistrationNumber = (value = "") =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 11);

export default function RegistrationVerificationField({
  value,
  onChange,
  brand,
  model,
  fuelType,
  required = false,
  initiallyVerified = false,
  onVerificationChange,
}) {
  const normalizedValue = normalizeRegistrationNumber(value);
  const [status, setStatus] = useState(initiallyVerified ? "verified" : "idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const verifiedNumberRef = useRef(initiallyVerified ? normalizedValue : "");
  const identityKey = `${brand || ""}::${model || ""}::${fuelType || ""}`;
  const previousIdentityRef = useRef(identityKey);

  const setVerified = (verified, verificationResult = null) => {
    if (verified) verifiedNumberRef.current = normalizedValue;
    else verifiedNumberRef.current = "";
    onVerificationChange?.(verified, verificationResult);
  };

  useEffect(() => {
    if (previousIdentityRef.current === identityKey) return;
    previousIdentityRef.current = identityKey;
    setStatus("idle");
    setMessage("");
    setResult(null);
    setVerified(false);
  }, [identityKey]);

  useEffect(() => {
    if (status === "verified" && normalizedValue !== verifiedNumberRef.current) {
      setStatus("idle");
      setMessage("");
      setResult(null);
      setVerified(false);
    }
  }, [normalizedValue, status]);

  const verify = async () => {
    if (!/^[A-Z0-9]{5,11}$/.test(normalizedValue)) {
      setStatus("error");
      setMessage("Enter a valid registration number using 5 to 11 letters and numbers.");
      setVerified(false);
      return;
    }

    try {
      setStatus("loading");
      setMessage("");
      setResult(null);

      const response = await api.post("/vehicles/verify-registration", {
        registrationNumber: normalizedValue,
        brand: brand || undefined,
        model: model || undefined,
        fuelType: fuelType || undefined,
      });
      const verification = response.data?.data || {};
      setResult(verification);

      if (!verification.verified) {
        setStatus("not-found");
        setMessage("We couldn't find this registration number. Check it and try again.");
        setVerified(false, verification);
        return;
      }

      if (verification.matchesSelectedVehicle === false) {
        setStatus("mismatch");
        setMessage(
          "This registration belongs to a different vehicle. Check the brand, model, and fuel type.",
        );
        setVerified(false, verification);
        return;
      }

      setStatus("verified");
      setMessage("Registration verified successfully.");
      setVerified(true, verification);
    } catch (error) {
      setStatus("error");
      setMessage(
        error.response?.data?.message ||
          "Vehicle verification is temporarily unavailable. Please try again.",
      );
      setVerified(false);
    }
  };

  const statusError = ["error", "not-found", "mismatch"].includes(status);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">Registration Number</span>
        <span
          className={`text-[11px] font-bold uppercase tracking-wide ${
            required ? "text-red-600" : "text-muted"
          }`}
        >
          {required ? "Required" : "Optional for your account"}
        </span>
      </div>

      <div className="grid gap-2 min-[430px]:grid-cols-[minmax(0,1fr)_auto]">
        <input
          value={value}
          onChange={(event) => onChange?.(event.target.value.toUpperCase())}
          placeholder="UP70AB1234"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={16}
          className="h-11 min-w-0 rounded-lg border border-line px-3 text-sm font-semibold uppercase tracking-wide text-ink outline-none transition focus:border-ink"
        />
        <button
          type="button"
          onClick={verify}
          disabled={status === "loading" || !normalizedValue}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-ink bg-white px-4 text-sm font-bold text-ink transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? <FiLoader className="animate-spin" /> : <FiShield />}
          {status === "loading" ? "Verifying..." : status === "verified" ? "Verified" : "Verify"}
        </button>
      </div>

      {status === "verified" && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-800">
          <div className="flex items-center gap-2 font-bold">
            <FiCheckCircle className="shrink-0" />
            Registration verified
          </div>
          {(result?.vehicle?.maker || result?.vehicle?.model) && (
            <p className="mt-1 leading-5">
              {[result.vehicle.maker, result.vehicle.model, result.vehicle.fuelType]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {result?.vehicle?.ownerNameMasked && (
            <p className="mt-0.5 text-green-700">
              RC owner: {result.vehicle.ownerNameMasked}
            </p>
          )}
        </div>
      )}

      {statusError && message && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {status === "idle" && (
        <p className="text-xs leading-5 text-muted">
          By clicking Verify, you consent to Rovauto checking this RC through our verification provider. Ownership is not claimed or verified.
        </p>
      )}
    </div>
  );
}

export { normalizeRegistrationNumber };
