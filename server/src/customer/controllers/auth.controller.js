const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/apiError");
const ApiResponse = require("../../utils/apiResponse");
const { verifyToken } = require("../../utils/jwt");
const authService = require("../services/auth.service");
const {
  ACCESS_TOKEN_COOKIE_NAME,
  SUPPORT_ACCESS_TOKEN_COOKIE_NAME,
  DEVICE_ID_COOKIE_NAME,
  accessTokenCookieOptions,
  accessTokenClearCookieOptions,
  supportAccessTokenCookieOptions,
  supportAccessTokenClearCookieOptions,
  deviceIdCookieOptions,
} = require("../../config/authCookie");

const getSessionMetadata = (req) => ({
  userAgent: req.get("user-agent") || "",
  deviceId: req.cookies?.[DEVICE_ID_COOKIE_NAME] || "",
});

const preventAuthResponseCaching = (res) => {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
};

const clearLegacySupportCookie = (req, res) => {
  const legacyToken = req.cookies?.[ACCESS_TOKEN_COOKIE_NAME];
  if (!legacyToken) return;

  try {
    const decoded = verifyToken(legacyToken);
    if (
      decoded?.accountType === "CUSTOMER_SUPPORT" ||
      decoded?.role === "CUSTOMER_SUPPORT"
    ) {
      res.clearCookie(
        ACCESS_TOKEN_COOKIE_NAME,
        accessTokenClearCookieOptions,
      );
    }
  } catch {
    // Do not clear a valid customer/staff cookie just because the optional
    // legacy migration check could not decode it.
  }
};

const sendAuthResponse = (res, statusCode, message, result, { support = false } = {}) => {
  if (!result?.token) {
    throw new ApiError(500, "Authentication token was not generated");
  }

  const { token, deviceId, ...safeResult } = result;

  const supportSession =
    support || result?.user?.accountType === "CUSTOMER_SUPPORT";

  res.cookie(
    supportSession
      ? SUPPORT_ACCESS_TOKEN_COOKIE_NAME
      : ACCESS_TOKEN_COOKIE_NAME,
    token,
    supportSession
      ? supportAccessTokenCookieOptions
      : accessTokenCookieOptions,
  );

  if (deviceId) {
    // Keep a stable, HttpOnly browser identifier so repeat logins from the
    // same device are counted as one device instead of one device per session.
    res.cookie(
      DEVICE_ID_COOKIE_NAME,
      deviceId,
      deviceIdCookieOptions,
    );
  }

  preventAuthResponseCaching(res);

  /*
   * The JWT is deliberately omitted from the JSON response.
   * The browser stores it only in the HttpOnly cookie.
   */
  return res
    .status(statusCode)
    .json(new ApiResponse(statusCode, message, safeResult));
};

const signup = asyncHandler(async (req, res) => {
  const result = await authService.signup(req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, "OTP sent to email.", result));
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyOtp(
    req.body,
    getSessionMetadata(req),
  );

  return sendAuthResponse(
    res,
    200,
    "Account verified successfully",
    result,
  );
});

const resendOtp = asyncHandler(async (req, res) => {
  const result = await authService.resendOtp(req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, "OTP resent successfully", result));
});

const sendPhoneOtp = asyncHandler(async (req, res) => {
  const result = await authService.sendPhoneOtp(req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, "OTP sent successfully", result));
});

const verifyPhoneOtp = asyncHandler(async (req, res) => {
  const authenticatedUserId =
    req.user?.accountType === "USER" ? req.user.id : null;

  const result = await authService.verifyPhoneNumberOtp(
    req.body,
    authenticatedUserId,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Phone verified successfully", result));
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(
    req.body,
    getSessionMetadata(req),
  );

  return sendAuthResponse(res, 200, "Login successful", result);
});


const supportLogin = asyncHandler(async (req, res) => {
  const result = await authService.login(
    {
      identifier: req.body.identifier,
      password: req.body.password,
      role: "CUSTOMER_SUPPORT",
    },
    getSessionMetadata(req),
  );

  // Older builds stored support sessions in the main accessToken cookie.
  // Remove only that legacy support token while preserving any real customer,
  // garage, admin or intern session already open in the same browser.
  clearLegacySupportCookie(req, res);

  return sendAuthResponse(
    res,
    200,
    "Customer support login successful",
    result,
    { support: true },
  );
});

const supportLogout = asyncHandler(async (req, res) => {
  const result = await authService.logout(
    req.user?.id,
    req.user?.accountType,
    req.authSessionId,
  );

  res.clearCookie(
    SUPPORT_ACCESS_TOKEN_COOKIE_NAME,
    supportAccessTokenClearCookieOptions,
  );

  preventAuthResponseCaching(res);

  return res
    .status(200)
    .json(new ApiResponse(200, "Customer support logged out successfully", result));
});

const supportMe = asyncHandler(async (req, res) => {
  const account = await authService.getMe(
    req.user.id,
    req.user.accountType,
  );

  preventAuthResponseCaching(res);

  return res
    .status(200)
    .json(new ApiResponse(200, "Customer support account fetched successfully", account));
});

const googleAuth = asyncHandler(async (req, res) => {
  const result = await authService.googleAuth(
    req.body,
    getSessionMetadata(req),
  );

  return sendAuthResponse(
    res,
    200,
    "Google authentication successful",
    result,
  );
});

const logout = asyncHandler(async (req, res) => {
  const result = await authService.logout(
    req.user?.id,
    req.user?.accountType,
    req.authSessionId,
  );

  res.clearCookie(
    ACCESS_TOKEN_COOKIE_NAME,
    accessTokenClearCookieOptions,
  );

  preventAuthResponseCaching(res);

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Logged out successfully", result),
    );
});

const me = asyncHandler(async (req, res) => {
  const account = await authService.getMe(
    req.user.id,
    req.user.accountType,
  );

  preventAuthResponseCaching(res);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Account fetched successfully",
        account,
      ),
    );
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Password reset OTP sent successfully",
        result,
      ),
    );
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, "Password reset successful", result));
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(
    req.user.id,
    req.user.accountType,
    req.body,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Password changed successfully", result));
});

module.exports = {
  signup,
  verifyOtp,
  resendOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  login,
  supportLogin,
  supportLogout,
  supportMe,
  googleAuth,
  logout,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
};
