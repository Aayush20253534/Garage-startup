import { signInWithPopup } from "firebase/auth";
import api from "@/api/axios";
import { auth, googleProvider } from "@/config/firebase";

const completeGoogleAuth = async (role = "CUSTOMER") => {
  const credential = await signInWithPopup(auth, googleProvider);
  const idToken = await credential.user.getIdToken();

  const response = await api.post("/auth/google", {
    idToken,
    role,
  });

  const data = response.data?.data;

  if (!data?.user) {
    throw new Error("Invalid Google authentication response");
  }

  // The API response sets the JWT as an HttpOnly cookie.
  // JavaScript receives only the non-sensitive user payload.
  return data;
};

export default completeGoogleAuth;
