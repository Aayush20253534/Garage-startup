const argon2 = require("argon2");

const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";

const cleanName = (value) => String(value || "").trim().slice(0, 120);
const cleanLoginId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
const cleanEmail = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
};

const accountSelect = {
  id: true,
  name: true,
  loginId: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  passwordChangedAt: true,
  createdAt: true,
  updatedAt: true,
};

const toConflictError = (error) => {
  if (error?.code !== "P2002") return null;

  const targets = Array.isArray(error?.meta?.target)
    ? error.meta.target
    : [error?.meta?.target].filter(Boolean);

  if (targets.some((target) => String(target).includes("email"))) {
    return new ApiError(409, "A staff account already uses this email");
  }

  return new ApiError(409, "A staff account already uses this intern ID");
};

const getIntern = async (accountId) => {
  const account = await prisma.staffAccount.findFirst({
    where: {
      id: accountId,
      role: "INTERN",
    },
    select: accountSelect,
  });

  if (!account) {
    throw new ApiError(404, "Intern account not found");
  }

  return account;
};

const listAccounts = async () =>
  prisma.staffAccount.findMany({
    where: { role: "INTERN" },
    select: accountSelect,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

const createAccount = async ({ name, loginId, email, password }) => {
  const normalizedName = cleanName(name);
  const normalizedLoginId = cleanLoginId(loginId);
  const normalizedEmail = cleanEmail(email);

  if (!normalizedName || !normalizedLoginId || !password) {
    throw new ApiError(400, "Name, intern ID and password are required");
  }

  if (!PASSWORD_REGEX.test(password)) {
    throw new ApiError(400, PASSWORD_MESSAGE);
  }

  try {
    return await prisma.staffAccount.create({
      data: {
        name: normalizedName,
        loginId: normalizedLoginId,
        email: normalizedEmail,
        password: await argon2.hash(password),
        role: "INTERN",
        isActive: true,
        passwordChangedAt: new Date(),
      },
      select: accountSelect,
    });
  } catch (error) {
    const conflictError = toConflictError(error);
    if (conflictError) throw conflictError;
    throw error;
  }
};

const updateAccount = async (accountId, data) => {
  await getIntern(accountId);

  const updateData = {};

  if (Object.prototype.hasOwnProperty.call(data, "name")) {
    const name = cleanName(data.name);
    if (!name) throw new ApiError(400, "Name is required");
    updateData.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(data, "loginId")) {
    const loginId = cleanLoginId(data.loginId);
    if (!loginId) throw new ApiError(400, "Intern ID is required");
    updateData.loginId = loginId;
  }

  if (Object.prototype.hasOwnProperty.call(data, "email")) {
    updateData.email = cleanEmail(data.email);
  }

  if (Object.prototype.hasOwnProperty.call(data, "isActive")) {
    updateData.isActive = Boolean(data.isActive);
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, "No intern account changes were provided");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.staffAccount.update({
        where: { id: accountId },
        data: updateData,
        select: accountSelect,
      });

      if (updateData.isActive === false) {
        await tx.staffSession.updateMany({
          where: {
            staffAccountId: accountId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      }

      return updated;
    });
  } catch (error) {
    const conflictError = toConflictError(error);
    if (conflictError) throw conflictError;
    throw error;
  }
};

const changePassword = async (accountId, password) => {
  if (!PASSWORD_REGEX.test(String(password || ""))) {
    throw new ApiError(400, PASSWORD_MESSAGE);
  }

  await getIntern(accountId);

  await prisma.$transaction([
    prisma.staffAccount.update({
      where: { id: accountId },
      data: {
        password: await argon2.hash(password),
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

  return { changed: true };
};

module.exports = {
  changePassword,
  createAccount,
  listAccounts,
  updateAccount,
};
