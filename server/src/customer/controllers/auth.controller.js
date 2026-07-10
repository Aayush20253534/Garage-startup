const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/apiError");
const ApiResponse = require("../../utils/apiResponse");
const authService = require("../services/auth.service");
const {
  ACCESS_TOKEN_COOKIE_NAME,
  accessTokenCookieOptions,
  accessTokenClearCookieOptions,
} = require("../../config/authCookie");

const getSessionMetadata = (req) => ({
  userAgent: req.get("user-agent") || "",
});

const preventAuthResponseCaching = (res) => {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
};

const sendAuthResponse = (res, statusCode, message, result) => {
  if (!result?.token) {
    throw new ApiError(500, "Authentication token was not generated");
  }

  const { token, ...safeResult } = result;

  res.cookie(
    ACCESS_TOKEN_COOKIE_NAME,
    token,
    accessTokenCookieOptions,
  );

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
  googleAuth,
  logout,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
};
