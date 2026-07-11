const argon2 = require("argon2");
const crypto = require("crypto");
const prisma = require("../../config/prisma");
const { verifyFirebaseIdToken } = require("../../config/firebase");
const ApiError = require("../../utils/apiError");
const hashOtp = require("../../utils/hashOtp");
const { normalizePhone } = require("../../utils/phone");
const {
  createSignupOtp,
  createPhoneOtp,
  verifyPhoneOtp,
  verifySignupOtp,
  createResetPasswordOtp,
} = require("./otp.service");
const { createAuthToken } = require("./token.service");
const {
  createCustomerSupportSession,
  createStaffSession,
  createUserSession,
  revokeCustomerSupportSession,
  revokeStaffSession,
  revokeUserSession,
} = require("./userSession.service");

const PENDING_SIGNUP_EXPIRY_MS = 15 * 60 * 1000;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";
const PASSWORD_RESET_REQUEST_MESSAGE =
  "If an active account exists for this email, a password reset OTP has been sent.";

const USER_ROLES = ["CUSTOMER", "GARAGE_OWNER"];
const STAFF_ROLES = ["ADMIN", "INTERN"];
const CUSTOMER_SUPPORT_ROLE = "CUSTOMER_SUPPORT";
const ALL_AUTH_ROLES = [...USER_ROLES, ...STAFF_ROLES, CUSTOMER_SUPPORT_ROLE];

const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

const normalizeLoginId = (value) =>
  String(value || "").trim().toLowerCase();

const normalizeAuthRole = (
  role,
  allowedRoles = ALL_AUTH_ROLES,
  fallback = "CUSTOMER",
) => (allowedRoles.includes(role) ? role : fallback);

const toSafeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  accountType: "USER",
  isActive: user.isActive,
  isEmailVerified: user.isEmailVerified,
  isPhoneVerified: user.isPhoneVerified,
  isOnboarded: user.isOnboarded,
});

const toSafeStaff = (staff) => ({
  id: staff.id,
  name: staff.name,
  loginId: staff.loginId,
  email: staff.email,
  phone: staff.phone,
  role: staff.role,
  accountType: "STAFF",
  isActive: staff.isActive,
  lastLoginAt: staff.lastLoginAt,
  passwordChangedAt: staff.passwordChangedAt,
  createdAt: staff.createdAt,
});


const toSafeCustomerSupport = (account) => ({
  id: account.id,
  name: account.name,
  email: account.email,
  role: CUSTOMER_SUPPORT_ROLE,
  accountType: "CUSTOMER_SUPPORT",
  isActive: account.isActive,
  lastLoginAt: account.lastLoginAt,
  passwordChangedAt: account.passwordChangedAt,
  createdAt: account.createdAt,
});

const getAuthUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      isOnboarded: true,
      isActive: true,
      customerProfile: true,
      vehicles: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      },
      locations: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      },
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return {
    ...user,
    accountType: "USER",
  };
};

const getAuthStaffById = async (staffId) => {
  const staff = await prisma.staffAccount.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      name: true,
      loginId: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      passwordChangedAt: true,
      createdAt: true,
    },
  });

  if (!staff) {
    throw new ApiError(404, "Staff account not found");
  }

  return {
    ...staff,
    accountType: "STAFF",
  };
};


const getAuthCustomerSupportById = async (accountId) => {
  const account = await prisma.customerSupportAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      lastLoginAt: true,
      passwordChangedAt: true,
      createdAt: true,
    },
  });

  if (!account) {
    throw new ApiError(404, "Customer support account not found");
  }

  return toSafeCustomerSupport(account);
};

const createUserAuthResult = async (
  user,
  sessionMetadata = {},
  extra = {},
) => {
  const safeUser = toSafeUser(user);
  const session = await createUserSession(user.id, sessionMetadata);
  const token = createAuthToken(safeUser, { sessionId: session.id });
  const authUser = await getAuthUserById(user.id);

  return {
    user: authUser,
    token,
    deviceId: session.deviceId,
    ...extra,
  };
};

const signup = async ({
  name,
  email,
  phone,
  password,
  confirmPassword,
  role = "CUSTOMER",
}) => {
  const cleanName = name?.trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhone(phone);
  const validRoles = ["CUSTOMER", "GARAGE_OWNER"];
  const userRole = normalizeAuthRole(role, validRoles, "CUSTOMER");

  if (!cleanName || !cleanEmail || !cleanPhone || !password) {
    throw new ApiError(400, "Name, email, phone and password are required");
  }

  if (!PASSWORD_REGEX.test(password)) {
    throw new ApiError(400, PASSWORD_MESSAGE);
  }

  if (password !== confirmPassword) {
    throw new ApiError(400, "Passwords do not match");
  }

  await prisma.pendingSignup.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
  });

  const existingUser = await prisma.user.findFirst({
    where: {
      role: userRole,
      OR: [{ email: cleanEmail }, { phone: cleanPhone }],
    },
  });

  if (existingUser) {
    throw new ApiError(
      409,
      existingUser.email === cleanEmail
        ? "User with this email already exists"
        : "User with this phone already exists"
    );
  }

  const conflictingPendingSignup = await prisma.pendingSignup.findFirst({
    where: {
      role: userRole,
      OR: [{ email: cleanEmail }, { phone: cleanPhone }],
      NOT: {
        AND: [{ email: cleanEmail }, { phone: cleanPhone }],
      },
    },
  });

  if (conflictingPendingSignup) {
    throw new ApiError(409, "Email or phone is already pending verification");
  }

  const hashedPassword = await argon2.hash(password);

  const pendingSignup = await prisma.pendingSignup.upsert({
    where: { email_role: { email: cleanEmail, role: userRole } },
    update: {
      name: cleanName,
      phone: cleanPhone,
      passwordHash: hashedPassword,
      role: userRole,
      isEmailVerified: false,
      isPhoneVerified: false,
      expiresAt: new Date(Date.now() + PENDING_SIGNUP_EXPIRY_MS),
    },
    create: {
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash: hashedPassword,
      role: userRole,
      expiresAt: new Date(Date.now() + PENDING_SIGNUP_EXPIRY_MS),
    },
  });

  try {
    await createSignupOtp({
      email: pendingSignup.email,
    });
  } catch (error) {
    if (error.statusCode === 429) {
      throw error;
    }

    await prisma.$transaction([
      prisma.emailOtp.deleteMany({
        where: { email: pendingSignup.email },
      }),
      prisma.phoneOtp.deleteMany({
        where: { phone: pendingSignup.phone },
      }),
      prisma.pendingSignup.deleteMany({
        where: { id: pendingSignup.id },
      }),
    ]);

    throw error;
  }

  return {
    email: pendingSignup.email,
    phone: pendingSignup.phone,
    message: "OTP sent to email.",
  };
};

const verifyOtp = async (
  { email, phone, otp, role = "CUSTOMER" },
  sessionMetadata = {},
) => {
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhone(phone);
  const userRole = normalizeAuthRole(role, ["CUSTOMER", "GARAGE_OWNER"], "CUSTOMER");

  const pendingSignup = await prisma.pendingSignup.findFirst({
    where: {
      email: cleanEmail,
      phone: cleanPhone,
      role: userRole,
    },
  });

  if (!pendingSignup || pendingSignup.expiresAt <= new Date()) {
    if (pendingSignup) {
      await prisma.pendingSignup.delete({ where: { id: pendingSignup.id } });
    }
    throw new ApiError(400, "Signup verification expired. Please register again.");
  }

  await verifySignupOtp({
    email: cleanEmail,
    otp,
  });

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: pendingSignup.name,
        email: pendingSignup.email,
        phone: pendingSignup.phone,
        password: pendingSignup.passwordHash,
        role: pendingSignup.role,
        isEmailVerified: true,
        isPhoneVerified: false,
        ...(pendingSignup.role === "CUSTOMER" && {
          customerProfile: { create: {} },
        }),
      },
    });

    await tx.pendingSignup.delete({
      where: { id: pendingSignup.id },
    });

    return createdUser;
  });

  return createUserAuthResult(user, sessionMetadata);
};

const resendOtp = async ({ email, phone, role = "CUSTOMER" }) => {
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhone(phone);
  const userRole = normalizeAuthRole(role, ["CUSTOMER", "GARAGE_OWNER"], "CUSTOMER");

  const pendingSignup = await prisma.pendingSignup.findFirst({
    where: {
      email: cleanEmail,
      phone: cleanPhone,
      role: userRole,
    },
  });

  if (!pendingSignup || pendingSignup.expiresAt <= new Date()) {
    throw new ApiError(400, "Signup verification expired. Please register again.");
  }

  await createSignupOtp({
    email: pendingSignup.email,
  });

  return {
    message: "OTP resent successfully",
  };
};

const sendPhoneOtp = async ({ phone }) => {
  const cleanPhone = normalizePhone(phone);

  await createPhoneOtp({
    phone: cleanPhone,
    otp: require("../../utils/generateOtp")(),
  });

  return {
    phone: cleanPhone,
    message: "OTP sent successfully",
  };
};

const verifyPhoneNumberOtp = async ({ phone, otp }, userId = null) => {
  const cleanPhone = normalizePhone(phone);

  await verifyPhoneOtp({
    phone: cleanPhone,
    otp,
  });

  if (userId) {
    await prisma.user.updateMany({
      where: {
        id: userId,
        phone: cleanPhone,
      },
      data: {
        isPhoneVerified: true,
      },
    });
  }

  return {
    phone: cleanPhone,
    verified: true,
  };
};

const login = async (
  { identifier, password, role },
  sessionMetadata = {},
) => {
  const rawIdentifier = String(identifier || "").trim();
  const requestedRole = normalizeAuthRole(
    role,
    ALL_AUTH_ROLES,
    "CUSTOMER",
  );

  if (!rawIdentifier || !password) {
    throw new ApiError(
      400,
      "Email, phone, or staff login ID and password are required",
    );
  }

  if (requestedRole === CUSTOMER_SUPPORT_ROLE) {
    const cleanEmail = normalizeEmail(rawIdentifier);
    const supportAccount = await prisma.customerSupportAccount.findUnique({
      where: { email: cleanEmail },
    });

    if (!supportAccount) {
      throw new ApiError(401, "Invalid credentials");
    }

    if (!supportAccount.isActive) {
      throw new ApiError(403, "Account is disabled");
    }

    const isPasswordValid = await argon2.verify(
      supportAccount.password,
      password,
    );

    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid credentials");
    }

    const updatedAccount = await prisma.customerSupportAccount.update({
      where: { id: supportAccount.id },
      data: { lastLoginAt: new Date() },
    });

    const safeAccount = toSafeCustomerSupport(updatedAccount);
    const session = await createCustomerSupportSession(
      updatedAccount.id,
      sessionMetadata,
    );
    const token = createAuthToken(safeAccount, { sessionId: session.id });

    return {
      user: safeAccount,
      token,
      deviceId: session.deviceId,
    };
  }

  if (STAFF_ROLES.includes(requestedRole)) {
    const normalizedIdentifier = normalizeLoginId(rawIdentifier);
    const normalizedPhone = rawIdentifier.startsWith("+")
      ? normalizePhone(rawIdentifier)
      : normalizedIdentifier;

    const staff = await prisma.staffAccount.findFirst({
      where: {
        role: requestedRole,
        OR: [
          { loginId: normalizedIdentifier },
          { email: normalizedIdentifier },
          { phone: normalizedPhone },
        ],
      },
    });

    if (!staff) {
      throw new ApiError(401, "Invalid credentials");
    }

    if (!staff.isActive) {
      throw new ApiError(403, "Account is disabled");
    }

    const isPasswordValid = await argon2.verify(
      staff.password,
      password,
    );

    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid credentials");
    }

    const updatedStaff = await prisma.staffAccount.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });

    const safeStaff = toSafeStaff(updatedStaff);
    const session = await createStaffSession(updatedStaff.id, sessionMetadata);
    const token = createAuthToken(safeStaff, { sessionId: session.id });
    const authStaff = await getAuthStaffById(updatedStaff.id);

    return {
      user: authStaff,
      token,
      deviceId: session.deviceId,
    };
  }

  const cleanIdentifier = rawIdentifier.startsWith("+")
    ? normalizePhone(rawIdentifier)
    : normalizeEmail(rawIdentifier);

  const user = await prisma.user.findFirst({
    where: {
      role: requestedRole,
      OR: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
    },
  });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Account is disabled");
  }

  const isPasswordValid = await argon2.verify(
    user.password,
    password,
  );

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (!user.isEmailVerified) {
    throw new ApiError(403, "Please verify your email before login");
  }

  return createUserAuthResult(user, sessionMetadata);
};

const getMe = async (accountId, accountType) => {
  if (accountType === "CUSTOMER_SUPPORT") {
    return getAuthCustomerSupportById(accountId);
  }

  if (accountType === "STAFF") {
    return getAuthStaffById(accountId);
  }

  if (accountType === "USER") {
    return getAuthUserById(accountId);
  }

  throw new ApiError(401, "Invalid account session");
};

const googleAuth = async (
  { idToken, role = "CUSTOMER" },
  sessionMetadata = {},
) => {
  const decodedToken = await verifyFirebaseIdToken(idToken);
  const cleanEmail = normalizeEmail(decodedToken.email);
  const cleanName =
    decodedToken.name?.trim() ||
    decodedToken.email?.split("@")[0] ||
    "Rovauto User";
  const validRoles = ["CUSTOMER", "GARAGE_OWNER"];
  const userRole = normalizeAuthRole(role, validRoles, "CUSTOMER");

  if (!cleanEmail || !decodedToken.email_verified) {
    throw new ApiError(400, "Google account email must be verified");
  }

  let user = await prisma.user.findFirst({
    where: { email: cleanEmail, role: userRole },
  });
  let isNewUser = false;

  if (user) {
    if (!user.isActive) {
      throw new ApiError(403, "Account is disabled");
    }

    if (!user.isEmailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true },
      });
    }
  } else {
    isNewUser = true;
    const randomPassword = await argon2.hash(crypto.randomBytes(32).toString("hex"));

    user = await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        password: randomPassword,
        role: userRole,
        isEmailVerified: true,
        isPhoneVerified: false,
        ...(userRole === "CUSTOMER" && {
          customerProfile: { create: {} },
        }),
      },
    });

    await prisma.pendingSignup.deleteMany({
      where: { email: cleanEmail, role: userRole },
    });
    await prisma.emailOtp.deleteMany({
      where: { email: cleanEmail },
    });
  }

  return createUserAuthResult(user, sessionMetadata, { isNewUser });
};

const forgotPassword = async ({
  email,
  role = "CUSTOMER",
}) => {
  const cleanEmail = normalizeEmail(email);
  const userRole = normalizeAuthRole(
    role,
    USER_ROLES,
    "CUSTOMER",
  );

  const user = await prisma.user.findFirst({
    where: {
      email: cleanEmail,
      role: userRole,
    },
  });

  if (!user || !user.isActive) {
    return {
      email: cleanEmail,
      message: PASSWORD_RESET_REQUEST_MESSAGE,
    };
  }

  await createResetPasswordOtp(user.id, user.email);

  return {
    email: cleanEmail,
    message: PASSWORD_RESET_REQUEST_MESSAGE,
  };
};

const resetPassword = async ({
  email,
  otp,
  newPassword,
  role = "CUSTOMER",
}) => {
  const cleanEmail = normalizeEmail(email);
  const userRole = normalizeAuthRole(
    role,
    USER_ROLES,
    "CUSTOMER",
  );

  if (!PASSWORD_REGEX.test(newPassword)) {
    throw new ApiError(400, PASSWORD_MESSAGE);
  }

  const user = await prisma.user.findFirst({
    where: {
      email: cleanEmail,
      role: userRole,
    },
  });

  if (!user || !user.isActive) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  const otpHash = hashOtp(otp);

  const validOtp = await prisma.otp.findFirst({
    where: {
      userId: user.id,
      otpHash,
      purpose: "RESET_PASSWORD",
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!validOtp) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  const hashedPassword = await argon2.hash(newPassword);

  await prisma.$transaction([
    prisma.otp.update({
      where: { id: validOtp.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
      },
    }),
    prisma.userSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    }),
  ]);

  return {
    message: "Password reset successful",
  };
};

const changePassword = async (
  accountId,
  accountType,
  { currentPassword, newPassword },
  currentSessionId = null,
) => {
  if (!currentPassword || !newPassword) {
    throw new ApiError(
      400,
      "Current password and new password are required",
    );
  }

  if (!PASSWORD_REGEX.test(newPassword)) {
    throw new ApiError(400, PASSWORD_MESSAGE);
  }

  if (accountType === "CUSTOMER_SUPPORT") {
    throw new ApiError(403, "Customer support passwords are managed by an admin");
  }

  const account =
    accountType === "STAFF"
      ? await prisma.staffAccount.findUnique({
          where: { id: accountId },
        })
      : accountType === "USER"
        ? await prisma.user.findUnique({
            where: { id: accountId },
          })
        : null;

  if (!account) {
    throw new ApiError(404, "Account not found");
  }

  const isCurrentPasswordValid = await argon2.verify(
    account.password,
    currentPassword,
  );

  if (!isCurrentPasswordValid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  const hashedPassword = await argon2.hash(newPassword);

  if (accountType === "STAFF") {
    await prisma.$transaction([
      prisma.staffAccount.update({
        where: { id: accountId },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
        },
      }),
      prisma.staffSession.updateMany({
        where: {
          staffAccountId: accountId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: accountId },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
        },
      }),
      prisma.userSession.updateMany({
        where: {
          userId: accountId,
          revokedAt: null,
          ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);
  }

  return {
    message: "Password changed successfully",
  };
};

const logout = async (accountId, accountType, sessionId) => {
  if (accountType === "USER" && accountId && sessionId) {
    await revokeUserSession(sessionId, accountId);
  }

  if (accountType === "STAFF" && accountId && sessionId) {
    await revokeStaffSession(sessionId, accountId);
  }

  if (accountType === "CUSTOMER_SUPPORT" && accountId && sessionId) {
    await revokeCustomerSupportSession(sessionId, accountId);
  }

  return { loggedOut: true };
};

module.exports = {
  signup,
  verifyOtp,
  resendOtp,
  sendPhoneOtp,
  verifyPhoneNumberOtp,
  login,
  googleAuth,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
};
