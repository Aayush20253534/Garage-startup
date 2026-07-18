import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import api from "@/api/axios";
import { auth, googleProvider } from "@/config/firebase";
import { verifyCurrentSession } from "@/utils/authSession";

export const GOOGLE_AUTH_PENDING_ROLE_KEY = "rov_google_auth_role";
const GOOGLE_AUTH_PENDING_OPTIONS_KEY = "rov_google_auth_options";

const writePendingRole = (role) => {
  sessionStorage.setItem(GOOGLE_AUTH_PENDING_ROLE_KEY, role);
  localStorage.setItem(GOOGLE_AUTH_PENDING_ROLE_KEY, role);
};

const writePendingOptions = (options) => {
  const value = JSON.stringify(options || {});
  sessionStorage.setItem(GOOGLE_AUTH_PENDING_OPTIONS_KEY, value);
  localStorage.setItem(GOOGLE_AUTH_PENDING_OPTIONS_KEY, value);
};

const readPendingOptions = () => {
  const value = sessionStorage.getItem(GOOGLE_AUTH_PENDING_OPTIONS_KEY) || localStorage.getItem(GOOGLE_AUTH_PENDING_OPTIONS_KEY);
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
};

const readPendingRole = () =>
  sessionStorage.getItem(GOOGLE_AUTH_PENDING_ROLE_KEY) ||
  localStorage.getItem(GOOGLE_AUTH_PENDING_ROLE_KEY);

const clearPendingRole = () => {
  sessionStorage.removeItem(GOOGLE_AUTH_PENDING_ROLE_KEY);
  localStorage.removeItem(GOOGLE_AUTH_PENDING_ROLE_KEY);
  sessionStorage.removeItem(GOOGLE_AUTH_PENDING_OPTIONS_KEY);
  localStorage.removeItem(GOOGLE_AUTH_PENDING_OPTIONS_KEY);
};

const shouldFallbackToRedirect = (error) => {
  const code = String(error?.code || "");
  const message = String(error?.message || "");

  return (
    code === "auth/popup-blocked" ||
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    /Cross-Origin-Opener-Policy|window\.closed|popup/i.test(message)
  );
};

const finishGoogleCredential = async (credential, role = "CUSTOMER", options = {}) => {
  if (!credential?.user) {
    return null;
  }

  const idToken = await credential.user.getIdToken(true);

  const response = await api.post("/auth/google", {
    idToken,
    role,
    mode: options.mode || "LOGIN",
    acceptedTerms: options.acceptedTerms === true,
    acceptedPrivacy: options.acceptedPrivacy === true,
  });

  const data = response.data?.data;

  if (!data?.user) {
    throw new Error("Invalid Google authentication response");
  }

  // Do not navigate until the cookie can authenticate a second request.
  // This prevents the UI from briefly opening the dashboard and then being
  // thrown back to login when the browser did not persist the cookie.
  const verifiedUser = await verifyCurrentSession({ expectedRole: role });

  return {
    ...data,
    user: verifiedUser,
  };
};

export const startGoogleAuth = async (role = "CUSTOMER", options = {}) => {
  writePendingRole(role);
  writePendingOptions(options);

  try {
    const credential = await signInWithPopup(auth, googleProvider);
    const result = await finishGoogleCredential(credential, role, options);
    clearPendingRole();
    return result;
  } catch (error) {
    if (shouldFallbackToRedirect(error)) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    clearPendingRole();
    throw error;
  }
};

export const completeGoogleRedirectAuth = async () => {
  const pendingRole = readPendingRole();
  const pendingOptions = readPendingOptions();

  if (!pendingRole) {
    return null;
  }

  const credential = await getRedirectResult(auth);

  if (!credential) {
    return null;
  }

  try {
    return await finishGoogleCredential(credential, pendingRole || "CUSTOMER", pendingOptions);
  } finally {
    clearPendingRole();
  }
};

export default startGoogleAuth;
