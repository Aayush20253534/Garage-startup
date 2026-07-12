const crypto = require("crypto");
const prisma = require("../../config/prisma");
const { sendGarageApplicationEmail } = require("./applicationEmail.service");

const WORKER_INTERVAL_MS = Math.max(
  15_000,
  Number(process.env.GARAGE_EMAIL_OUTBOX_INTERVAL_MS || 60_000),
);
const LOCK_TIMEOUT_MS = Math.max(
  60_000,
  Number(process.env.GARAGE_EMAIL_OUTBOX_LOCK_TIMEOUT_MS || 10 * 60_000),
);
const BATCH_SIZE = Math.max(
  1,
  Math.min(Number(process.env.GARAGE_EMAIL_OUTBOX_BATCH_SIZE || 20), 100),
);
const workerId = `${process.pid}-${crypto.randomUUID()}`;

let workerTimer = null;
let processing = false;

const truncateError = (error) =>
  String(error?.message || error || "Unknown email delivery error").slice(0, 1000);

const getRetryDelayMs = (attempts) => {
  const scheduleMinutes = [1, 5, 15, 60, 360, 720];
  const minutes = scheduleMinutes[Math.min(Math.max(attempts - 1, 0), scheduleMinutes.length - 1)];
  return minutes * 60_000;
};

const enqueueGarageApplicationEmail = async ({
  client = prisma,
  applicationId,
  dedupeKey,
  to,
  subject,
  message,
  requeue = false,
}) => {
  const update = {
    recipient: String(to || "").trim().toLowerCase(),
    subject: String(subject || "").trim(),
    message: String(message || ""),
    applicationId: applicationId || null,
    ...(requeue && {
      status: "PENDING",
      nextAttemptAt: new Date(),
      lastError: null,
      lockedAt: null,
      lockedBy: null,
    }),
  };

  return client.garageApplicationEmailOutbox.upsert({
    where: { dedupeKey },
    update,
    create: {
      ...update,
      dedupeKey,
      status: "PENDING",
      nextAttemptAt: new Date(),
    },
  });
};

const claimOutboxEmail = async (outboxId) => {
  const now = new Date();
  const staleLock = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  const claimed = await prisma.garageApplicationEmailOutbox.updateMany({
    where: {
      id: outboxId,
      status: { not: "SENT" },
      OR: [
        {
          status: { in: ["PENDING", "FAILED"] },
          nextAttemptAt: { lte: now },
        },
        {
          status: "PROCESSING",
          lockedAt: { lte: staleLock },
        },
      ],
    },
    data: {
      status: "PROCESSING",
      lockedAt: now,
      lockedBy: workerId,
    },
  });

  if (claimed.count === 0) return null;

  return prisma.garageApplicationEmailOutbox.findUnique({
    where: { id: outboxId },
  });
};

const dispatchOutboxEmail = async (outboxId) => {
  const item = await claimOutboxEmail(outboxId);

  if (!item) {
    const existing = await prisma.garageApplicationEmailOutbox.findUnique({
      where: { id: outboxId },
      select: { id: true, status: true, attempts: true, sentAt: true, lastError: true },
    });

    return existing || { id: outboxId, status: "NOT_FOUND" };
  }

  try {
    await sendGarageApplicationEmail({
      to: item.recipient,
      subject: item.subject,
      message: item.message,
    });

    return prisma.garageApplicationEmailOutbox.update({
      where: { id: item.id },
      data: {
        status: "SENT",
        attempts: { increment: 1 },
        sentAt: new Date(),
        lastError: null,
        lockedAt: null,
        lockedBy: null,
      },
      select: { id: true, status: true, attempts: true, sentAt: true, lastError: true },
    });
  } catch (error) {
    const attempts = item.attempts + 1;
    return prisma.garageApplicationEmailOutbox.update({
      where: { id: item.id },
      data: {
        status: "FAILED",
        attempts,
        nextAttemptAt: new Date(Date.now() + getRetryDelayMs(attempts)),
        lastError: truncateError(error),
        lockedAt: null,
        lockedBy: null,
      },
      select: { id: true, status: true, attempts: true, sentAt: true, lastError: true },
    });
  }
};

const dispatchOutboxByDedupeKey = async (dedupeKey) => {
  const item = await prisma.garageApplicationEmailOutbox.findUnique({
    where: { dedupeKey },
    select: { id: true },
  });

  return item ? dispatchOutboxEmail(item.id) : null;
};

const processPendingGarageApplicationEmails = async () => {
  if (processing) return;
  processing = true;

  try {
    const now = new Date();
    const staleLock = new Date(now.getTime() - LOCK_TIMEOUT_MS);
    const items = await prisma.garageApplicationEmailOutbox.findMany({
      where: {
        OR: [
          {
            status: { in: ["PENDING", "FAILED"] },
            nextAttemptAt: { lte: now },
          },
          {
            status: "PROCESSING",
            lockedAt: { lte: staleLock },
          },
        ],
      },
      select: { id: true },
      orderBy: { nextAttemptAt: "asc" },
      take: BATCH_SIZE,
    });

    await Promise.allSettled(items.map((item) => dispatchOutboxEmail(item.id)));
  } finally {
    processing = false;
  }
};

const startGarageApplicationEmailOutboxWorker = () => {
  if (workerTimer) return workerTimer;

  void processPendingGarageApplicationEmails().catch((error) => {
    console.error("[garage-email-outbox] Initial processing failed:", error.message);
  });

  workerTimer = setInterval(() => {
    void processPendingGarageApplicationEmails().catch((error) => {
      console.error("[garage-email-outbox] Processing failed:", error.message);
    });
  }, WORKER_INTERVAL_MS);
  workerTimer.unref?.();

  return workerTimer;
};

const stopGarageApplicationEmailOutboxWorker = () => {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
};

module.exports = {
  dispatchOutboxByDedupeKey,
  dispatchOutboxEmail,
  enqueueGarageApplicationEmail,
  processPendingGarageApplicationEmails,
  startGarageApplicationEmailOutboxWorker,
  stopGarageApplicationEmailOutboxWorker,
};
