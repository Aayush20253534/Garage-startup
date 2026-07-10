const prisma = require("../../config/prisma");
const webPushService = require("../../services/webPush.service");

const normalizePayload = ({
  title,
  message,
  type = "SUPPORT_TICKET",
  link = null,
  metadata = undefined,
}) => ({
  title: String(title || "Rovauto Support").trim().slice(0, 160),
  message: String(message || "").trim().slice(0, 1000),
  type: String(type || "SUPPORT_TICKET").trim().slice(0, 60),
  link: link ? String(link).trim().slice(0, 500) : null,
  metadata,
});

const notifyAccount = async (supportAccountId, payload) => {
  if (!supportAccountId) return null;

  const data = normalizePayload(payload);
  const notify = await prisma.notify.create({
    data: {
      supportAccountId,
      ...data,
    },
  });

  const push = await webPushService
    .sendPushToSupportAccount(supportAccountId, notify)
    .catch((error) => {
      console.warn("[support-notify] push delivery failed", {
        supportAccountId,
        notifyId: notify.id,
        message: error?.message || "Unknown error",
      });
      return { sent: 0, failed: 1, removed: 0 };
    });

  return { notify, push };
};

const notifyAllActive = async (payload) => {
  const accounts = await prisma.customerSupportAccount.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  if (accounts.length === 0) {
    return { created: 0, push: { sent: 0, failed: 0, removed: 0 } };
  }

  const data = normalizePayload(payload);
  const accountIds = accounts.map((account) => account.id);
  const result = await prisma.notify.createMany({
    data: accountIds.map((supportAccountId) => ({
      supportAccountId,
      ...data,
    })),
  });

  const push = await webPushService
    .sendPushToSupportAccounts(accountIds, data)
    .catch((error) => {
      console.warn("[support-notify] broadcast push delivery failed", {
        accountCount: accountIds.length,
        message: error?.message || "Unknown error",
      });
      return { sent: 0, failed: accountIds.length, removed: 0 };
    });

  return { created: result.count, push };
};

const notifyTicketQueue = async (ticket, payload) => {
  const common = {
    ...payload,
    type:
      payload.type ||
      (ticket.type === "DISPUTE" ? "DISPUTE" : "SUPPORT_TICKET"),
    link: payload.link || `/support/tickets?ticket=${ticket.id}`,
    metadata: {
      ...(payload.metadata || {}),
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      ticketType: ticket.type,
    },
  };

  if (ticket.supportAssigneeId) {
    return notifyAccount(ticket.supportAssigneeId, common);
  }

  return notifyAllActive(common);
};

module.exports = {
  notifyAccount,
  notifyAllActive,
  notifyTicketQueue,
};
