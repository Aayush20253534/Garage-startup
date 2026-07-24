const argon2 = require("argon2");

const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";

const cleanName = (value) => String(value || "").trim().slice(0, 120);
const cleanEmail = (value) => String(value || "").trim().toLowerCase();

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

const getAccount = async (accountId) => {
  const account = await prisma.staffAccount.findFirst({
    where: { id: accountId, role: "SUB_ADMIN" },
    select: accountSelect,
  });
  if (!account) throw new ApiError(404, "Sub-admin account not found");
  return account;
};

const listAccounts = async () =>
  prisma.staffAccount.findMany({
    where: { role: "SUB_ADMIN" },
    select: accountSelect,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

const createAccount = async ({ name, email, password }, creator) => {
  const normalizedName = cleanName(name);
  const normalizedEmail = cleanEmail(email);
  if (!normalizedName || !normalizedEmail || !password) {
    throw new ApiError(400, "Name, email and password are required");
  }
  if (!PASSWORD_REGEX.test(password)) throw new ApiError(400, PASSWORD_MESSAGE);

  try {
    return await prisma.staffAccount.create({
      data: {
        name: normalizedName,
        loginId: normalizedEmail,
        email: normalizedEmail,
        password: await argon2.hash(password),
        role: "SUB_ADMIN",
        isActive: true,
        passwordChangedAt: new Date(),
        createdById: creator?.id || null,
        createdByName: creator?.name || creator?.loginId || "Main admin",
      },
      select: accountSelect,
    });
  } catch (error) {
    const conflict = toConflictError(error);
    if (conflict) throw conflict;
    throw error;
  }
};

const updateAccount = async (accountId, data) => {
  await getAccount(accountId);
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
    updateData.isActive = Boolean(data.isActive);
  }
  if (!Object.keys(updateData).length) {
    throw new ApiError(400, "No sub-admin changes were provided");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const account = await tx.staffAccount.update({
        where: { id: accountId },
        data: updateData,
        select: accountSelect,
      });
      if (updateData.isActive === false) {
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
