import { getRedirectResult, signInWithRedirect } from "firebase/auth";
import api from "@/api/axios";
import { auth, googleProvider } from "@/config/firebase";
import { verifyCurrentSession } from "@/utils/authSession";

export const GOOGLE_AUTH_PENDING_ROLE_KEY = "rov_google_auth_role";

const finishGoogleCredential = async (credential, role = "CUSTOMER") => {
  if (!credential?.user) {
    return null;
  }

  const idToken = await credential.user.getIdToken(true);

  const response = await api.post("/auth/google", {
    idToken,
    role,
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

export const startGoogleAuth = async (role = "CUSTOMER") => {
  sessionStorage.setItem(GOOGLE_AUTH_PENDING_ROLE_KEY, role);
  await signInWithRedirect(auth, googleProvider);
};

export const completeGoogleRedirectAuth = async () => {
  const role =
    sessionStorage.getItem(GOOGLE_AUTH_PENDING_ROLE_KEY) || "CUSTOMER";
  const credential = await getRedirectResult(auth);

  if (!credential) {
    return null;
  }

  try {
    return await finishGoogleCredential(credential, role);
  } finally {
    sessionStorage.removeItem(GOOGLE_AUTH_PENDING_ROLE_KEY);
  }
};

export default startGoogleAuth;
