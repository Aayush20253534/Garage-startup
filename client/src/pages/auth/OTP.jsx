import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/common/Logo";
import api from "@/api/axios";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";
import { verifyCurrentSession } from "@/utils/authSession";
import CustomerLoginLoader from "@/components/auth/CustomerLoginLoader";
import {
  hasSavedUserLocation,
  saveSignupLocationToProfile,
} from "@/utils/signupLocation";

const PENDING_OTP_KEY = "pendingSignupOtp";
const OTP_LENGTH = 6;

const readPendingOtp = () => {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_OTP_KEY) || "{}");
  } catch {
    sessionStorage.removeItem(PENDING_OTP_KEY);
    return {};
  }
};

const getPendingOtp = (state) => {
  const stored = readPendingOtp();

  return {
    email: state?.email ?? stored.email ?? "",
    phone: state?.phone ?? stored.phone ?? "",
    role: state?.role ?? stored.role ?? "CUSTOMER",
    signupLocation:
      state?.signupLocation ?? stored.signupLocation ?? null,
  };
};

const hasCoordinates = (location) =>
  Number.isFinite(Number(location?.latitude)) &&
  Number.isFinite(Number(location?.longitude));

export default function OTP() {
  const routeLocation = useLocation();
  const nav = useNavigate();
  const { login, loginGarage } = useApp();
  const submitLockRef = useRef(false);
  const resendLockRef = useRef(false);
  const refs = useRef([]);

  const { email, phone, role, signupLocation } = getPendingOtp(
    routeLocation.state,
  );

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!email || !phone) {
      nav("/register", { replace: true });
      return;
    }

    refs.current[0]?.focus();
  }, [email, phone, nav]);

  useEffect(() => {
    if (timer <= 0) return undefined;

    const timeoutId = window.setTimeout(() => {
      setTimer((previous) => previous - 1);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [timer]);

  const setDigit = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return;

    setOtp((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });

    if (value && index < OTP_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    const digits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);

    if (!digits) return;

    event.preventDefault();
    setOtp(Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] || ""));
    refs.current[Math.min(digits.length, OTP_LENGTH) - 1]?.focus();
  };

  const finishCustomerLogin = async (initialUser) => {
    let freshUser = initialUser;

    // Set the role hint and safe UI state immediately. The HttpOnly cookie was
    // already created by the verification endpoint.
    login(freshUser);

    if (
      role === "CUSTOMER" &&
      signupLocation &&
      (await saveSignupLocationToProfile(signupLocation))
    ) {
      freshUser = {
        ...freshUser,
        customerProfile: {
          ...(freshUser.customerProfile || {}),
          address: signupLocation.address,
        },
        locations: hasCoordinates(signupLocation)
          ? [
              {
                latitude: Number(signupLocation.latitude),
                longitude: Number(signupLocation.longitude),
                address: signupLocation.address,
                source: "GPS",
                isDefault: true,
              },
              ...(freshUser.locations || []).filter((item) => !item.isDefault),
            ]
          : freshUser.locations || [],
      };

      login(freshUser);
    }

    sessionStorage.removeItem(PENDING_OTP_KEY);

    if (!hasSavedUserLocation(freshUser)) {
      nav("/booking/address", {
        replace: true,
        state: {
          from: routeLocation.state?.from || { pathname: "/dashboard" },
        },
      });
      return;
    }

    if (!freshUser.isOnboarded) {
      nav("/booking/vehicle", { replace: true });
      return;
    }

    nav("/dashboard", { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitLockRef.current) return;

    const finalOtp = otp.join("");

    if (!/^\d{6}$/.test(finalOtp)) {
      setError("Enter the complete 6-digit OTP.");
      return;
    }

    submitLockRef.current = true;
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/verify-otp", {
        email,
        phone,
        otp: finalOtp,
        role,
      });

      const data = response.data?.data;
      const responseUser = data?.user;

      if (!responseUser) {
        throw new Error("Invalid OTP verification response");
      }

      const freshUser = await verifyCurrentSession({
        expectedRole: responseUser.role,
      });

      if (freshUser.role === "GARAGE_OWNER") {
        sessionStorage.removeItem(PENDING_OTP_KEY);

        const garage = await garageApi.getProfile();
        if (!garage) {
          throw new Error("Account verified, but the garage profile could not be loaded.");
        }

        loginGarage(garage);
        nav("/garage", { replace: true });
        return;
      }

      await finishCustomerLogin(freshUser);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "OTP verification failed",
      );
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  const resend = async () => {
    if (resendLockRef.current || timer > 0) return;

    resendLockRef.current = true;
    setError("");
    setResending(true);

    try {
      await api.post("/auth/resend-otp", {
        email,
        phone,
        role,
      });

      setOtp(Array(OTP_LENGTH).fill(""));
      setTimer(60);
      refs.current[0]?.focus();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not resend OTP",
      );
    } finally {
      resendLockRef.current = false;
      setResending(false);
    }
  };

  return (
    <>
      <CustomerLoginLoader
        visible={loading || resending}
        eyebrow="ACCOUNT VERIFICATION"
        title={resending ? "Sending a new OTP" : "Verifying your account"}
        message={
          resending
            ? "Requesting a fresh verification code for your account."
            : "Confirming your code and preparing your customer profile."
        }
      />
      <div className="container-x grid min-h-[80vh] place-items-center py-16">
      <div className="card-soft w-full max-w-md p-7 text-center">
        <Logo className="mx-auto h-10" showText={false} />

        <h2 className="mt-4 text-2xl font-bold">Verify your account</h2>

        <p className="mt-1 text-sm text-muted">
          Enter the 6-digit OTP sent to{" "}
          <span className="font-medium text-ink">{email}</span>
        </p>

        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="mt-6">
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {otp.map((value, index) => (
              <input
                key={index}
                ref={(element) => {
                  refs.current[index] = element;
                }}
                value={value}
                onChange={(event) => setDigit(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                maxLength={1}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                disabled={loading}
                aria-label={`OTP digit ${index + 1}`}
                className="h-14 w-12 rounded-2xl border border-ink text-center text-xl font-bold outline-none disabled:opacity-60"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify & Continue"}
          </button>

          <div className="mt-4 text-sm text-muted">
            {timer > 0 ? (
              `Resend in ${timer}s`
            ) : (
              <button
                type="button"
                onClick={resend}
                disabled={resending || loading}
                className="font-medium text-ink disabled:opacity-60"
              >
                {resending ? "Sending..." : "Resend OTP"}
              </button>
            )}
          </div>
        </form>
      </div>
      </div>
    </>
  );
}
