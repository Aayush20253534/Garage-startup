const argon2 = require("argon2");
const crypto = require("crypto");
const prisma = require("../../config/prisma");
const { verifyFirebaseIdToken } = require("../../config/firebase");
const ApiError = require("../../utils/apiError");
const { normalizeEmail } = require("../../utils/email");
const { normalizePhone } = require("../../utils/phone");
const {
  createSignupOtp,
  createPhoneOtp,
  verifyPhoneOtp,
  verifySignupOtp,
  createResetPasswordOtp,
  createGarageResetPasswordOtp,
  consumeGarageOwnerOtp,
  consumeUserOtp,
  throwOtpResult,
} = require("./otp.service");
const { createAuthToken } = require("./token.service");
const {
  createCustomerSupportSession,
  createGarageOwnerSession,
  createGarageControllerSession,
  createStaffSession,
  createUserSession,
  revokeCustomerSupportSession,
  revokeGarageOwnerSession,
  revokeGarageControllerSession,
  revokeStaffSession,
  revokeUserSession,
} = require("./userSession.service");
const garageControllerService = require("../../garage/services/controller.service");
const {
  createChallenge: createStaffLoginChallenge,
  verifyChallenge: verifyStaffLoginChallenge,
  resendChallenge: resendStaffLoginChallenge,
} = require("./staffTwoFactor.service");
const {
  getPasswordChangeSessionRevocation,
} = require("../security/passwordSessionRevocation");
const staffPasswordResetService = require("./staffPasswordReset.service");
const {
  sendNewUserSignupNotification,
} = require("./newUserSignupNotification.service");

const PENDING_SIGNUP_EXPIRY_MS = 15 * 60 * 1000;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";
const PASSWORD_RESET_REQUEST_MESSAGE =
  "If an active account exists for this email, a password reset OTP has been sent.";
const INVALID_LOGIN_MESSAGE =
  "Invalid email, phone, login ID, or password";
const CUSTOMER_BLOCKED_MESSAGE =
  "You are blocked from using Rovauto. Please contact customer support.";
const CUSTOMER_BLOCKED_CODE = "CUSTOMER_BLOCKED";

const notifyNewCustomerSignup = async (user, signupMethod) => {
  try {
    await sendNewUserSignupNotification({ user, signupMethod });
  } catch (error) {
    console.error("[new-user-signup-email] notification failed", {
      userId: user?.id || null,
      signupMethod,
      message: error?.message || String(error),
    });
  }
};

const recordStaffSecurityAudit = async ({ staff, action, path, sessionMetadata = {}, metadata = {} }) => {
  if (!staff?.id || !STAFF_ROLES.includes(staff.role)) return;
  await prisma.adminAuditLog.create({
    data: {
      actorId: staff.id,
      actorName: staff.name || staff.loginId || staff.email || null,
      actorEmail: staff.email || null,
      actorLoginId: staff.loginId || null,
      actorRole: staff.role,
      action,
      resource: "authentication",
      resourceId: staff.id,
      method: "POST",
      path,
      statusCode: 200,
      userAgent: sessionMetadata.userAgent || null,
      metadata,
    },
  }).catch((error) => {
    console.warn("[staff-audit] unable to record security action", error?.message || error);
  });
};

let dummyPasswordHashPromise = null;

const getDummyPasswordHash = () => {
  if (!dummyPasswordHashPromise) {
    dummyPasswordHashPromise = argon2.hash(
      crypto.randomBytes(32).toString("hex"),
    );
  }

  return dummyPasswordHashPromise;
};

const verifyLoginPassword = async (passwordHash, password) => {
  const hash = passwordHash || (await getDummyPasswordHash());

  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
};

const USER_ROLES = ["CUSTOMER"];
const GARAGE_OWNER_ROLE = "GARAGE_OWNER";
const GARAGE_CONTROLLER_ROLE = "GARAGE_CONTROLLER";
const STAFF_ROLES = ["ADMIN", "SUB_ADMIN", "INTERN"];
const CUSTOMER_SUPPORT_ROLE = "CUSTOMER_SUPPORT";
const ALL_AUTH_ROLES = [
  ...USER_ROLES,
  GARAGE_OWNER_ROLE,
  GARAGE_CONTROLLER_ROLE,
  ...STAFF_ROLES,
  CUSTOMER_SUPPORT_ROLE,
];

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
  vehicleRegistrationRequired: user.vehicleRegistrationRequired === true,
  mustChangePassword: false,
});

const toSafeGarageOwner = (owner) => ({
  id: owner.id,
  name: owner.name,
  email: owner.email,
  phone: owner.phone,
  role: GARAGE_OWNER_ROLE,
  accountType: "USER",
  isActive: owner.isActive,
  isEmailVerified: owner.isEmailVerified,
  isPhoneVerified: owner.isPhoneVerified,
  isOnboarded: owner.isOnboarded,
  mustChangePassword: !owner.passwordChangedAt,
});

const toSafeGarageController = (controller) => ({
  id: controller.id,
  garageId: controller.garageId,
  name: controller.name,
  email: controller.email,
  phone: controller.phone,
  role: GARAGE_CONTROLLER_ROLE,
  accountType: "GARAGE_CONTROLLER",
  isActive: controller.isActive,
  availability: controller.availability,
  lastLoginAt: controller.lastLoginAt,
  lastActiveAt: controller.lastActiveAt,
  mustChangePassword: false,
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
      vehicleRegistrationRequired: true,
      passwordChangedAt: true,
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

  const { passwordChangedAt, ...safeUser } = user;

  return {
    ...safeUser,
    accountType: "USER",
    mustChangePassword: false,
  };
};

const getAuthGarageOwnerById = async (garageOwnerId) => {
  const owner = await prisma.garageOwner.findUnique({
    where: { id: garageOwnerId },
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
      passwordChangedAt: true,
      createdAt: true,
    },
  });

  if (!owner) {
    throw new ApiError(404, "Garage owner account not found");
  }

  return toSafeGarageOwner(owner);
};

const getAuthGarageControllerById = async (controllerId) => {
  const controller = await prisma.garageController.findFirst({
    where: { id: controllerId, deletedAt: null },
    select: {
      id: true,
      garageId: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      availability: true,
      lastLoginAt: true,
      lastActiveAt: true,
      passwordChangedAt: true,
      createdAt: true,
    },
  });
  if (!controller) throw new ApiError(404, "Garage controller account not found");
  return toSafeGarageController(controller);
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

const createGarageOwnerAuthResult = async (owner, sessionMetadata = {}) => {
  const safeOwner = toSafeGarageOwner(owner);
  const session = await createGarageOwnerSession(owner.id, sessionMetadata);
  const token = createAuthToken(safeOwner, { sessionId: session.id });

  return {
    user: await getAuthGarageOwnerById(owner.id),
    token,
    deviceId: session.deviceId,
  };
};

const createGarageControllerAuthResult = async (controller, sessionMetadata = {}) => {
  const updated = await prisma.garageController.update({
    where: { id: controller.id },
    data: { lastLoginAt: new Date(), lastActiveAt: new Date() },
  });
  const safeController = toSafeGarageController(updated);
  const session = await createGarageControllerSession(updated.id, sessionMetadata);
  const token = createAuthToken(safeController, { sessionId: session.id });
  return { user: safeController, token, deviceId: session.deviceId };
};

const findCustomerIdentity = async ({ email = null, phone = null } = {}) => {
  const [customerByEmail, customerByPhone] = await Promise.all([
    email
      ? prisma.user.findUnique({
          where: {
            email_role: {
              email,
              role: "CUSTOMER",
            },
          },
        })
      : null,
    phone
      ? prisma.user.findUnique({
          where: {
            phone_role: {
              phone,
              role: "CUSTOMER",
            },
          },
        })
      : null,
  ]);

  return { customerByEmail, customerByPhone };
};

const signup = async ({
  name,
  email,
  phone,
  password,
  confirmPassword,
  role = "CUSTOMER",
  acceptedTerms,
  acceptedPrivacy,
}) => {
  const cleanName = name?.trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhone(phone);
  if (role && role !== "CUSTOMER") {
    throw new ApiError(403, "Garage owner accounts are created only after application approval");
  }
  const userRole = "CUSTOMER";
  if (acceptedTerms !== true || acceptedPrivacy !== true) {
    throw new ApiError(400, "Accept the Terms and Conditions and Privacy Policy to create an account");
  }
  const consentAcceptedAt = new Date();

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

  const { customerByEmail, customerByPhone } = await findCustomerIdentity({
    email: cleanEmail,
    phone: cleanPhone,
  });

  if (customerByEmail || customerByPhone) {
    throw new ApiError(
      409,
      customerByEmail
        ? "A customer account with this email already exists"
        : "A customer account with this phone already exists"
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
      termsAcceptedAt: consentAcceptedAt,
      privacyAcceptedAt: consentAcceptedAt,
    },
    create: {
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash: hashedPassword,
      role: userRole,
      expiresAt: new Date(Date.now() + PENDING_SIGNUP_EXPIRY_MS),
      termsAcceptedAt: consentAcceptedAt,
      privacyAcceptedAt: consentAcceptedAt,
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
  if (role && role !== "CUSTOMER") {
    throw new ApiError(403, "Garage owner accounts are created only after application approval");
  }
  const userRole = "CUSTOMER";

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

  const { customerByEmail, customerByPhone } = await findCustomerIdentity({
    email: cleanEmail,
    phone: cleanPhone,
  });

  if (customerByEmail || customerByPhone) {
    await prisma.pendingSignup.delete({ where: { id: pendingSignup.id } });
    throw new ApiError(
      409,
      customerByEmail
        ? "A customer account with this email already exists"
        : "A customer account with this phone already exists",
    );
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
        authProvider: "PASSWORD",
        vehicleRegistrationRequired: pendingSignup.role === "CUSTOMER",
        termsAcceptedAt: pendingSignup.termsAcceptedAt,
        privacyAcceptedAt: pendingSignup.privacyAcceptedAt,
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

  await notifyNewCustomerSignup(user, "PASSWORD");

  return createUserAuthResult(user, sessionMetadata);
};

const resendOtp = async ({ email, phone, role = "CUSTOMER" }) => {
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhone(phone);
  if (role && role !== "CUSTOMER") {
    throw new ApiError(403, "Garage owner accounts are created only after application approval");
  }
  const userRole = "CUSTOMER";

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

    const isPasswordValid = await verifyLoginPassword(
      supportAccount?.password,
      password,
    );

    if (!supportAccount || !supportAccount.isActive || !isPasswordValid) {
      throw new ApiError(401, INVALID_LOGIN_MESSAGE, "INVALID_CREDENTIALS");
    }

    return createStaffLoginChallenge({
      accountId: supportAccount.id,
      accountType: "CUSTOMER_SUPPORT",
      role: CUSTOMER_SUPPORT_ROLE,
      email: supportAccount.email,
    });
  }

  if (STAFF_ROLES.includes(requestedRole)) {
    const normalizedIdentifier = normalizeLoginId(rawIdentifier);
    const normalizedEmail = normalizeEmail(rawIdentifier);
    const normalizedPhone = rawIdentifier.startsWith("+")
      ? normalizePhone(rawIdentifier)
      : normalizedIdentifier;

    const staff = await prisma.staffAccount.findFirst({
      where: {
        role: requestedRole,
        OR: [
          { loginId: normalizedIdentifier },
          { email: normalizedEmail },
          { phone: normalizedPhone },
        ],
      },
    });

    const isPasswordValid = await verifyLoginPassword(
      staff?.password,
      password,
    );

    if (!staff || !staff.isActive || !isPasswordValid) {
      throw new ApiError(401, INVALID_LOGIN_MESSAGE, "INVALID_CREDENTIALS");
    }

    return createStaffLoginChallenge({
      accountId: staff.id,
      accountType: "STAFF",
      role: staff.role,
      email: staff.email,
    });
  }

  if (requestedRole === GARAGE_CONTROLLER_ROLE) {
    let cleanPhone = null;
    try {
      cleanPhone = normalizePhone(rawIdentifier);
    } catch {
      // Fall back to the optional email identifier.
    }
    const cleanEmail = cleanPhone ? null : normalizeEmail(rawIdentifier);
    const controller = await prisma.garageController.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(cleanPhone ? [{ phone: cleanPhone }] : []),
          ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ],
      },
      include: {
        garage: { select: { controllerAccountsEnabled: true, isActive: true } },
      },
    });
    const isPasswordValid = await verifyLoginPassword(controller?.password, password);
    if (
      !controller ||
      !controller.isActive ||
      controller.garage?.isActive === false ||
      controller.garage?.controllerAccountsEnabled === false ||
      !isPasswordValid
    ) {
      throw new ApiError(401, INVALID_LOGIN_MESSAGE, "INVALID_CREDENTIALS");
    }
    return createGarageControllerAuthResult(controller, sessionMetadata);
  }

  if (requestedRole === GARAGE_OWNER_ROLE) {
    const cleanEmail = normalizeEmail(rawIdentifier);
    let cleanPhone = null;

    try {
      cleanPhone = normalizePhone(rawIdentifier);
    } catch {
      // A non-phone identifier can still be a valid garage-owner email.
    }

    const owner = await prisma.garageOwner.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          ...(cleanPhone ? [{ phone: cleanPhone }] : []),
        ],
      },
    });
    const isPasswordValid = await verifyLoginPassword(
      owner?.password,
      password,
    );

    if (
      !owner ||
      !owner.isActive ||
      (owner.email && !owner.isEmailVerified) ||
      !isPasswordValid
    ) {
      throw new ApiError(401, INVALID_LOGIN_MESSAGE, "INVALID_CREDENTIALS");
    }

    return createGarageOwnerAuthResult(owner, sessionMetadata);
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

  const isPasswordValid = await verifyLoginPassword(
    user?.password,
    password,
  );

  if (!user || !user.isEmailVerified || !isPasswordValid) {
    throw new ApiError(401, INVALID_LOGIN_MESSAGE, "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new ApiError(
      403,
      CUSTOMER_BLOCKED_MESSAGE,
      CUSTOMER_BLOCKED_CODE,
    );
  }

  return createUserAuthResult(user, sessionMetadata);
};

const verifyStaffLoginOtp = async (
  { challengeId, otp },
  sessionMetadata = {},
) => {
  const challenge = await verifyStaffLoginChallenge({ challengeId, otp });

  if (challenge.accountType === "CUSTOMER_SUPPORT") {
    const account = await prisma.customerSupportAccount.findUnique({
      where: { id: challenge.accountId },
    });

    if (!account || !account.isActive || challenge.role !== CUSTOMER_SUPPORT_ROLE) {
      throw new ApiError(401, "Staff account is no longer available");
    }

    const updatedAccount = await prisma.customerSupportAccount.update({
      where: { id: account.id },
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

  if (challenge.accountType === "STAFF") {
    const staff = await prisma.staffAccount.findUnique({
      where: { id: challenge.accountId },
    });

    if (!staff || !staff.isActive || staff.role !== challenge.role) {
      throw new ApiError(401, "Staff account is no longer available");
    }

    const updatedStaff = await prisma.staffAccount.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });
    const safeStaff = toSafeStaff(updatedStaff);
    const session = await createStaffSession(updatedStaff.id, sessionMetadata);
    const token = createAuthToken(safeStaff, { sessionId: session.id });
    const authStaff = await getAuthStaffById(updatedStaff.id);
    await recordStaffSecurityAudit({
      staff: authStaff,
      action: "LOGIN_SUCCEEDED",
      path: "/auth/staff/verify-otp",
      sessionMetadata,
      metadata: { sessionId: session.id },
    });

    return {
      user: authStaff,
      token,
      deviceId: session.deviceId,
    };
  }

  throw new ApiError(400, "Invalid login challenge");
};

const resendStaffLoginOtp = async ({ challengeId }) =>
  resendStaffLoginChallenge(challengeId);

const getMe = async (accountId, accountType, role = null) => {
  if (accountType === "GARAGE_CONTROLLER") {
    return getAuthGarageControllerById(accountId);
  }
  if (accountType === "CUSTOMER_SUPPORT") {
    return getAuthCustomerSupportById(accountId);
  }

  if (accountType === "STAFF") {
    return getAuthStaffById(accountId);
  }

  if (accountType === "USER") {
    if (role === GARAGE_OWNER_ROLE) {
      return getAuthGarageOwnerById(accountId);
    }
    return getAuthUserById(accountId);
  }

  throw new ApiError(401, "Invalid account session");
};

const googleAuth = async (
  { idToken, role = "CUSTOMER", mode, acceptedTerms = false, acceptedPrivacy = false },
  sessionMetadata = {},
) => {
  const decodedToken = await verifyFirebaseIdToken(idToken);
  const cleanEmail = normalizeEmail(decodedToken.email);
  const cleanName =
    decodedToken.name?.trim() ||
    decodedToken.email?.split("@")[0] ||
    "Rovauto User";
  if (role && role !== "CUSTOMER") {
    throw new ApiError(403, "Garage owner accounts cannot be created through Google sign-in");
  }
  const userRole = "CUSTOMER";

  if (!cleanEmail || !decodedToken.email_verified) {
    throw new ApiError(400, "Google account email must be verified");
  }

  const firebaseUid = String(decodedToken.uid || decodedToken.sub || "").trim();
  if (!firebaseUid) throw new ApiError(400, "Google account identity is unavailable");

  const [customerByFirebaseUid, { customerByEmail }] = await Promise.all([
    prisma.user.findUnique({ where: { firebaseUid } }),
    findCustomerIdentity({ email: cleanEmail }),
  ]);

  if (
    customerByFirebaseUid &&
    (customerByFirebaseUid.role !== userRole ||
      (customerByEmail && customerByEmail.id !== customerByFirebaseUid.id))
  ) {
    throw new ApiError(409, "This Google identity is linked to a different account");
  }

  let user = customerByFirebaseUid || customerByEmail;
  let isNewUser = false;

  if (mode === "LOGIN") {
    if (!user || user.authProvider !== "GOOGLE") {
      throw new ApiError(404, "No Google signup was found. Create your Rovauto account with Google first.", "GOOGLE_SIGNUP_REQUIRED");
    }
    if (!user.firebaseUid) {
      user = await prisma.user.update({ where: { id: user.id }, data: { firebaseUid } });
    }
    if (user.firebaseUid !== firebaseUid) {
      throw new ApiError(409, "This email is linked to a different Google identity");
    }
    if (!user.isActive) {
      throw new ApiError(
        403,
        CUSTOMER_BLOCKED_MESSAGE,
        CUSTOMER_BLOCKED_CODE,
      );
    }

    if (!user.isEmailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true },
      });
    }
  } else {
    if (acceptedTerms !== true || acceptedPrivacy !== true) {
      throw new ApiError(400, "Accept the Terms and Conditions and Privacy Policy to sign up with Google");
    }
    if (user) {
      throw new ApiError(409, user.authProvider === "GOOGLE" ? "This Google account already exists. Use Google login." : "An account with this email already exists. Use email login.");
    }
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
        authProvider: "GOOGLE",
        vehicleRegistrationRequired: userRole === "CUSTOMER",
        firebaseUid,
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
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

  if (isNewUser) {
    await notifyNewCustomerSignup(user, "GOOGLE");
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
    [...USER_ROLES, GARAGE_OWNER_ROLE, GARAGE_CONTROLLER_ROLE, "SUB_ADMIN", "INTERN"],
    "CUSTOMER",
  );

  if (userRole === GARAGE_CONTROLLER_ROLE) {
    return garageControllerService.requestPasswordReset(cleanEmail);
  }

  if (["SUB_ADMIN", "INTERN"].includes(userRole)) {
    const staff = await prisma.staffAccount.findFirst({
      where: {
        email: cleanEmail,
        role: userRole,
      },
    });

    if (staff?.isActive && staff.email) {
      await staffPasswordResetService.createChallenge({
        staffAccountId: staff.id,
        role: staff.role,
        email: staff.email,
      });
    }

    return {
      email: cleanEmail,
      message: PASSWORD_RESET_REQUEST_MESSAGE,
    };
  }

  if (userRole === GARAGE_OWNER_ROLE) {
    const owner = await prisma.garageOwner.findUnique({
      where: { email: cleanEmail },
    });

    if (owner?.isActive) {
      await createGarageResetPasswordOtp(owner.id, owner.email);
    }

    return {
      email: cleanEmail,
      message: PASSWORD_RESET_REQUEST_MESSAGE,
    };
  }

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
}, sessionMetadata = {}) => {
  const cleanEmail = normalizeEmail(email);
  const userRole = normalizeAuthRole(
    role,
    [...USER_ROLES, GARAGE_OWNER_ROLE, GARAGE_CONTROLLER_ROLE, "SUB_ADMIN", "INTERN"],
    "CUSTOMER",
  );

  if (!PASSWORD_REGEX.test(newPassword)) {
    throw new ApiError(400, PASSWORD_MESSAGE);
  }

  if (userRole === GARAGE_CONTROLLER_ROLE) {
    return garageControllerService.resetPasswordWithOtp({
      email: cleanEmail,
      otp,
      newPassword,
    });
  }

  if (["SUB_ADMIN", "INTERN"].includes(userRole)) {
    const staff = await prisma.staffAccount.findFirst({
      where: {
        email: cleanEmail,
        role: userRole,
      },
    });

    if (!staff?.isActive) {
      throw new ApiError(400, "Invalid or expired OTP");
    }

    const hashedPassword = await argon2.hash(newPassword);
    const changedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await staffPasswordResetService.consumeChallenge({
        client: tx,
        staffAccountId: staff.id,
        otp,
      });

      await tx.staffAccount.update({
        where: { id: staff.id },
        data: {
          password: hashedPassword,
          passwordChangedAt: changedAt,
        },
      });
      await tx.staffSession.updateMany({
        where: {
          staffAccountId: staff.id,
          revokedAt: null,
        },
        data: { revokedAt: changedAt },
      });
    });

    await recordStaffSecurityAudit({
      staff,
      action: "PASSWORD_RESET_SELF",
      path: "/auth/reset-password",
      sessionMetadata,
      metadata: { sessionsRevoked: true },
    });

    return { message: "Password reset successful" };
  }

  if (userRole === GARAGE_OWNER_ROLE) {
    const owner = await prisma.garageOwner.findUnique({
      where: { email: cleanEmail },
    });

    if (!owner?.isActive) {
      throw new ApiError(400, "Invalid or expired OTP");
    }

    const hashedPassword = await argon2.hash(newPassword);
    const changedAt = new Date();
    const otpResult = await prisma.$transaction(async (tx) => {
      const result = await consumeGarageOwnerOtp({
        client: tx,
        garageOwnerId: owner.id,
        purpose: "RESET_PASSWORD",
        otp,
      });

      if (!result.ok) return result;

      await tx.garageOwner.update({
        where: { id: owner.id },
        data: {
          password: hashedPassword,
          passwordChangedAt: changedAt,
        },
      });
      await tx.garageOwnerSession.updateMany({
        where: { garageOwnerId: owner.id, revokedAt: null },
        data: { revokedAt: changedAt },
      });

      return result;
    });

    throwOtpResult(otpResult);
    return { message: "Password reset successful" };
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

  const hashedPassword = await argon2.hash(newPassword);
  const changedAt = new Date();

  const otpResult = await prisma.$transaction(async (tx) => {
    const result = await consumeUserOtp({
      client: tx,
      userId: user.id,
      purpose: "RESET_PASSWORD",
      otp,
    });

    if (!result.ok) return result;

    await tx.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: changedAt,
      },
    });

    await tx.userSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: { revokedAt: changedAt },
    });

    return result;
  });

  throwOtpResult(otpResult);

  return {
    message: "Password reset successful",
  };
};

const changePassword = async (
  accountId,
  accountType,
  { currentPassword, newPassword },
  currentSessionId = null,
  role = null,
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

  const isGarageController = accountType === "GARAGE_CONTROLLER";

  const isGarageOwner =
    accountType === "USER" && role === GARAGE_OWNER_ROLE;
  const account =
    isGarageController
      ? await prisma.garageController.findFirst({ where: { id: accountId, deletedAt: null } })
      : isGarageOwner
      ? await prisma.garageOwner.findUnique({
          where: { id: accountId },
        })
      : accountType === "STAFF"
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

  const isSamePassword = await argon2.verify(account.password, newPassword);
  if (isSamePassword) {
    throw new ApiError(400, "New password cannot be same as current password");
  }

  const hashedPassword = await argon2.hash(newPassword);
  const sessionRevocation = isGarageOwner
    ? null
    : getPasswordChangeSessionRevocation({
        accountType,
        accountId,
        currentSessionId,
      });

  if (isGarageController) {
    await prisma.$transaction([
      prisma.garageController.update({
        where: { id: accountId },
        data: { password: hashedPassword, passwordChangedAt: new Date() },
      }),
      prisma.garageControllerSession.updateMany({
        where: {
          garageControllerId: accountId,
          revokedAt: null,
          ...(currentSessionId ? { id: { not: String(currentSessionId) } } : {}),
        },
        data: { revokedAt: new Date() },
      }),
    ]);
  } else if (isGarageOwner) {
    await prisma.$transaction([
      prisma.garageOwner.update({
        where: { id: accountId },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
        },
      }),
      prisma.garageOwnerSession.updateMany({
        where: {
          garageOwnerId: accountId,
          revokedAt: null,
          ...(currentSessionId
            ? { id: { not: String(currentSessionId) } }
            : {}),
        },
        data: { revokedAt: new Date() },
      }),
    ]);
  } else if (accountType === "STAFF") {
    await prisma.$transaction([
      prisma.staffAccount.update({
        where: { id: accountId },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
        },
      }),
      prisma.staffSession.updateMany({
        where: sessionRevocation.where,
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
        where: sessionRevocation.where,
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

const logout = async (accountId, accountType, sessionId, role = null) => {
  if (accountType === "GARAGE_CONTROLLER" && accountId && sessionId) {
    await revokeGarageControllerSession(sessionId, accountId);
  }
  if (accountType === "USER" && accountId && sessionId) {
    if (role === GARAGE_OWNER_ROLE) {
      await revokeGarageOwnerSession(sessionId, accountId);
    } else {
      await revokeUserSession(sessionId, accountId);
    }
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
  verifyStaffLoginOtp,
  resendStaffLoginOtp,
  googleAuth,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
};
