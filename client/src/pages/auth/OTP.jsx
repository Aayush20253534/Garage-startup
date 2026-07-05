import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/common/Logo";
import api from "@/api/axios";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";
import {
  hasSavedUserLocation,
  saveSignupLocationToProfile,
} from "@/utils/signupLocation";

const PENDING_OTP_KEY = "pendingSignupOtp";

const getPendingOtp = (state) => {
  let stored = {};

  try {
    stored = JSON.parse(sessionStorage.getItem(PENDING_OTP_KEY) || "{}");
  } catch {
    sessionStorage.removeItem(PENDING_OTP_KEY);
  }

  if (state?.email && state?.phone) {
    return {
      email: state.email,
      phone: state.phone,
      role: state.role || stored.role || "CUSTOMER",
      signupLocation: state.signupLocation || stored.signupLocation || null,
    };
  }

  if (stored.email && stored.phone) {
    return {
      email: stored.email,
      phone: stored.phone,
      role: stored.role || "CUSTOMER",
      signupLocation: stored.signupLocation || null,
    };
  }

  return {
    email: "",
    phone: "",
    role: "CUSTOMER",
    signupLocation: null,
  };
};

export default function OTP() {
  const routeLocation = useLocation();
  const { state } = routeLocation;
  const nav = useNavigate();
  const { login, loginGarage } = useApp();

  const { email, phone, role, signupLocation } = getPendingOtp(state);

  const [otp, setOtp] = useState(Array(6).fill(""));
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refs = useRef([]);

  useEffect(() => {
    if (!email || !phone) {
      nav("/register", { replace: true });
    }
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

    const next = [...otp];
    next[index] = value;
    setOtp(next);

    if (value && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const submit = async (event) => {
    event.preventDefault();

    const finalOtp = otp.join("");

    if (finalOtp.length !== 6) {
      setError("Enter 6 digit OTP");
      return;
    }

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
      let freshUser = data?.user;

      if (!freshUser) {
        throw new Error("Invalid OTP verification response");
      }

      // The verification endpoint must set the HttpOnly authentication cookie.
      // No JWT is stored or read by frontend JavaScript.
      if (await saveSignupLocationToProfile(signupLocation)) {
        freshUser = {
          ...freshUser,
          customerProfile: {
            ...(freshUser.customerProfile || {}),
            address: signupLocation.address,
          },
          locations:
            signupLocation.latitude && signupLocation.longitude
              ? [
                  {
                    latitude: signupLocation.latitude,
                    longitude: signupLocation.longitude,
                    address: signupLocation.address,
                    isDefault: true,
                  },
                  ...(freshUser.locations || []),
                ]
              : freshUser.locations || [],
        };
      }

      sessionStorage.removeItem(PENDING_OTP_KEY);

      if (freshUser.role === "GARAGE_OWNER") {
        const garage = await garageApi.getProfile();
        loginGarage(garage);
        nav("/garage", { replace: true });
        return;
      }

      login(freshUser);

      if (!hasSavedUserLocation(freshUser)) {
        nav("/booking/address", {
          replace: true,
          state: {
            from: routeLocation.state?.from || {
              pathname: "/dashboard",
            },
          },
        });
      } else if (!freshUser.isOnboarded) {
        nav("/booking/vehicle", { replace: true });
      } else {
        nav("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "OTP verification failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");

    try {
      await api.post("/auth/resend-otp", {
        email,
        phone,
        role,
      });

      setTimer(60);
    } catch (err) {
      setError(err.response?.data?.message || "Could not resend OTP");
    }
  };

  return (
    <div className="container-x py-16 min-h-[80vh] grid place-items-center">
      <div className="card-soft p-7 max-w-md w-full text-center">
        <Logo className="h-10 mx-auto" showText={false} />

        <h2 className="text-2xl font-bold mt-4">Verify your account</h2>

        <p className="text-sm text-muted mt-1">
          Enter the 6-digit OTP sent to{" "}
          <span className="text-ink font-medium">{email}</span>
        </p>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <form onSubmit={submit} className="mt-6">
          <div className="flex justify-center gap-2">
            {otp.map((value, index) => (
              <input
                key={index}
                ref={(element) => {
                  refs.current[index] = element;
                }}
                value={value}
                onChange={(event) => setDigit(index, event.target.value)}
                maxLength={1}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                className="h-14 w-12 text-center text-xl font-bold rounded-2xl border border-ink outline-none"
              />
            ))}
          </div>

          <button disabled={loading} className="btn-primary mt-6 w-full">
            {loading ? "Verifying..." : "Verify & Continue"}
          </button>

          <div className="text-sm text-muted mt-4">
            {timer > 0 ? (
              `Resend in ${timer}s`
            ) : (
              <button
                type="button"
                onClick={resend}
                className="text-ink font-medium"
              >
                Resend OTP
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
