const prisma = require("../../config/prisma");

const normalizePayload = ({ title, message, link = null, metadata = undefined }) => ({
  title: String(title || "Rovauto Support").trim().slice(0, 160),
  message: String(message || "").trim().slice(0, 1000),
  link: link ? String(link).trim().slice(0, 500) : null,
  metadata,
});

const notifyAccount = async (supportAccountId, payload) => {
  if (!supportAccountId) return null;

  return prisma.customerSupportNotification.create({
    data: {
      supportAccountId,
      ...normalizePayload(payload),
    },
  });
};

const notifyAllActive = async (payload) => {
  const accounts = await prisma.customerSupportAccount.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  if (accounts.length === 0) return { created: 0 };

  const data = normalizePayload(payload);
  const result = await prisma.customerSupportNotification.createMany({
    data: accounts.map((account) => ({
      supportAccountId: account.id,
      ...data,
    })),
  });

  return { created: result.count };
};

const notifyTicketQueue = async (ticket, payload) => {
  const common = {
    ...payload,
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
