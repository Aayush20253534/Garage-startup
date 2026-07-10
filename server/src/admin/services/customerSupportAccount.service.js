const argon2 = require("argon2");

const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";

const cleanEmail = (value) => String(value || "").trim().toLowerCase();
const cleanName = (value) => String(value || "").trim().slice(0, 120);

const accountSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  lastLoginAt: true,
  passwordChangedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      assignedTickets: true,
      messages: true,
      emailLogs: true,
    },
  },
};

const listAccounts = async () => {
  const accounts = await prisma.customerSupportAccount.findMany({
    select: accountSelect,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  const activeAssignments = await prisma.supportTicket.groupBy({
    by: ["supportAssigneeId"],
    where: {
      supportAssigneeId: { not: null },
      status: { in: ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER"] },
    },
    _count: { _all: true },
  });

  const activeByAccount = new Map(
    activeAssignments.map((item) => [item.supportAssigneeId, item._count._all]),
  );

  return accounts.map((account) => ({
    ...account,
    activeTicketCount: activeByAccount.get(account.id) || 0,
  }));
};

const createAccount = async ({ name, email, password }) => {
  const normalizedName = cleanName(name);
  const normalizedEmail = cleanEmail(email);

  if (!normalizedName || !normalizedEmail || !password) {
    throw new ApiError(400, "Name, email and password are required");
  }

  if (!PASSWORD_REGEX.test(password)) {
    throw new ApiError(400, PASSWORD_MESSAGE);
  }

  const existing = await prisma.customerSupportAccount.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError(409, "A customer support account already uses this email");
  }

  return prisma.customerSupportAccount.create({
    data: {
      name: normalizedName,
      email: normalizedEmail,
      password: await argon2.hash(password),
      passwordChangedAt: new Date(),
    },
    select: accountSelect,
  });
};

const updateAccount = async (accountId, data) => {
  const account = await prisma.customerSupportAccount.findUnique({
    where: { id: accountId },
    select: { id: true, email: true },
  });

  if (!account) throw new ApiError(404, "Customer support account not found");

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
  }

  if (Object.prototype.hasOwnProperty.call(data, "isActive")) {
    updateData.isActive = Boolean(data.isActive);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.customerSupportAccount.update({
        where: { id: accountId },
        data: updateData,
        select: accountSelect,
      });

      if (updateData.isActive === false) {
        await tx.supportTicket.updateMany({
          where: {
            supportAssigneeId: accountId,
            status: { in: ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER"] },
          },
          data: {
            supportAssigneeId: null,
            claimedAt: null,
          },
        });
      }

      return updated;
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw new ApiError(409, "A customer support account already uses this email");
    }
    throw error;
  }
};

const changePassword = async (accountId, password) => {
  if (!PASSWORD_REGEX.test(String(password || ""))) {
    throw new ApiError(400, PASSWORD_MESSAGE);
  }

  const account = await prisma.customerSupportAccount.findUnique({
    where: { id: accountId },
    select: { id: true },
  });

  if (!account) throw new ApiError(404, "Customer support account not found");

  await prisma.customerSupportAccount.update({
    where: { id: accountId },
    data: {
      password: await argon2.hash(password),
      passwordChangedAt: new Date(),
    },
  });

  return { changed: true };
};

module.exports = {
  changePassword,
  createAccount,
  listAccounts,
  updateAccount,
};
