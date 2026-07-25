const argon2 = require("argon2");

const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";
const ADMIN_ROLES = ["ADMIN", "SUB_ADMIN"];

const cleanName = (value) => String(value || "").trim().slice(0, 120);
const cleanEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeAdminRole = (value, fallback = "SUB_ADMIN") => {
  const role = String(value || fallback).trim().toUpperCase();
  if (!ADMIN_ROLES.includes(role)) {
    throw new ApiError(400, "Role must be ADMIN or SUB_ADMIN");
  }
  return role;
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
  createdById: true,
  createdByName: true,
  createdAt: true,
  updatedAt: true,
};

const toConflictError = (error) => {
  if (error?.code !== "P2002") return null;
  return new ApiError(409, "A staff account already uses this email address");
};

const getAccount = async (accountId, client = prisma) => {
  const account = await client.staffAccount.findFirst({
    where: { id: accountId, role: { in: ADMIN_ROLES } },
    select: accountSelect,
  });
  if (!account) throw new ApiError(404, "Admin account not found");
  return account;
};

const listAccounts = async () =>
  prisma.staffAccount.findMany({
    where: { role: { in: ADMIN_ROLES } },
    select: accountSelect,
    orderBy: [{ role: "asc" }, { isActive: "desc" }, { name: "asc" }],
  });

const assertMainAdminCanAssignRole = ({ creator, role }) => {
  if (role === "ADMIN" && creator?.role !== "ADMIN") {
    throw new ApiError(403, "Only a Main Admin can create another Main Admin");
  }
};

const createAccount = async ({ name, email, password, role }, creator) => {
  const normalizedName = cleanName(name);
  const normalizedEmail = cleanEmail(email);
  const normalizedRole = normalizeAdminRole(role);

  if (!normalizedName || !normalizedEmail || !password) {
    throw new ApiError(400, "Name, email and password are required");
  }
  if (!PASSWORD_REGEX.test(password)) throw new ApiError(400, PASSWORD_MESSAGE);

  assertMainAdminCanAssignRole({ creator, role: normalizedRole });

  try {
    return await prisma.staffAccount.create({
      data: {
        name: normalizedName,
        loginId: normalizedEmail,
        email: normalizedEmail,
        password: await argon2.hash(password),
        role: normalizedRole,
        isActive: true,
        passwordChangedAt: new Date(),
        createdById: creator?.id || null,
        createdByName:
          creator?.name || creator?.loginId ||
          (creator?.role === "ADMIN" ? "Main Admin" : "Admin"),
      },
      select: accountSelect,
    });
  } catch (error) {
    const conflict = toConflictError(error);
    if (conflict) throw conflict;
    throw error;
  }
};

const ensureAnotherActiveMainAdmin = async (tx, accountId) => {
  const remainingMainAdmins = await tx.staffAccount.count({
    where: {
      id: { not: accountId },
      role: "ADMIN",
      isActive: true,
    },
  });

  if (remainingMainAdmins < 1) {
    throw new ApiError(409, "At least one active Main Admin must remain");
  }
};

const updateAccount = async (accountId, data, actor) => {
  const existing = await getAccount(accountId);
  const updateData = {};

  if (Object.prototype.hasOwnProperty.call(data, "name")) {
    const name = cleanName(data.name);
    if (!name) throw new ApiError(400, "Name is required");
    updateData.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(data, "email")) {
    const email = cleanEmail(data.email);
    if (!email) throw new ApiError(400, "Email is required");
    updateData.email = email;
    updateData.loginId = email;
  }

  if (Object.prototype.hasOwnProperty.call(data, "isActive")) {
    const isActive = Boolean(data.isActive);
    if (accountId === actor?.id && !isActive) {
      throw new ApiError(400, "You cannot disable your own signed-in account");
    }
    updateData.isActive = isActive;
  }

  if (Object.prototype.hasOwnProperty.call(data, "role")) {
    const role = normalizeAdminRole(data.role, existing.role);
    if (role !== existing.role) {
      if (actor?.role !== "ADMIN") {
        throw new ApiError(403, "Only a Main Admin can switch admin roles");
      }
      if (accountId === actor?.id) {
        throw new ApiError(400, "You cannot change your own role while signed in");
      }
      updateData.role = role;
    }
  }

  if (!Object.keys(updateData).length) {
    throw new ApiError(400, "No admin account changes were provided");
  }

  const roleChanged = Boolean(updateData.role && updateData.role !== existing.role);
  const deactivatingMainAdmin =
    existing.role === "ADMIN" && updateData.isActive === false;
  const demotingMainAdmin =
    existing.role === "ADMIN" && updateData.role === "SUB_ADMIN";

  try {
    return await prisma.$transaction(async (tx) => {
      if (deactivatingMainAdmin || demotingMainAdmin) {
        await ensureAnotherActiveMainAdmin(tx, accountId);
      }

      const account = await tx.staffAccount.update({
        where: { id: accountId },
        data: updateData,
        select: accountSelect,
      });

      if (updateData.isActive === false || roleChanged) {
        await tx.staffSession.updateMany({
          where: { staffAccountId: accountId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return account;
    });
  } catch (error) {
    const conflict = toConflictError(error);
    if (conflict) throw conflict;
    throw error;
  }
};

const changePassword = async (accountId, password) => {
  if (!PASSWORD_REGEX.test(String(password || ""))) {
    throw new ApiError(400, PASSWORD_MESSAGE);
  }

  await getAccount(accountId);
  const changedAt = new Date();
  await prisma.$transaction([
    prisma.staffAccount.update({
      where: { id: accountId },
      data: { password: await argon2.hash(password), passwordChangedAt: changedAt },
    }),
    prisma.staffSession.updateMany({
      where: { staffAccountId: accountId, revokedAt: null },
      data: { revokedAt: changedAt },
    }),
  ]);

  return { changed: true };
};

module.exports = { listAccounts, createAccount, updateAccount, changePassword };
