import { signInWithPopup } from "firebase/auth";
import api from "@/api/axios";
import { auth, googleProvider } from "@/config/firebase";
import { verifyCurrentSession } from "@/utils/authSession";

const completeGoogleAuth = async (role = "CUSTOMER") => {
  const credential = await signInWithPopup(auth, googleProvider);
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

export default completeGoogleAuth;
