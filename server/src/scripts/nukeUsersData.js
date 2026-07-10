require("dotenv/config");

const fs = require("fs");
const path = require("path");

const prisma = require("../config/prisma");

const args = process.argv.slice(2);

const hasFlag = (name) => args.includes(`--${name}`);

const getArg = (name) => {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : "";
};

const usage = () => {
  console.log(`
Usage:
  npm run db:nuke-users
  npm run db:nuke-users -- --confirm --i-understand-delete-all-users

Dry-run is the default. Confirmed runs first create a JSON backup, then delete users.
Garages and service catalog data are preserved. Garage owner links are cleared.

Optional:
  --backup-dir=./backups

Example:
  npm run db:nuke-users -- --confirm --i-understand-delete-all-users
`);
};

const getBackupDir = () => {
  const customDir = getArg("backup-dir");

  return customDir
    ? path.resolve(process.cwd(), customDir)
    : path.resolve(process.cwd(), "backups");
};

const getTimestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

const collectCounts = async () => {
  const [
    users,
    customerProfiles,
    customerLocations,
    vehicles,
    bookings,
    payments,
    complaints,
    notifications,
    userSessions,
    pushSubscriptions,
    otps,
    reviews,
    wallets,
    walletTransactions,
    pendingSignups,
    emailOtps,
    phoneOtps,
    ownedGarageLinks,
    customerActivities,
    chatbotConversations,
    chatbotMessages,
    supportTickets,
    supportTicketMessages,
    supportTicketAttachments,
    bookingTrackingPoints,
    customerSupportEmailLogsLinkedToUsers,
    systemIssuesLinkedToUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.customerProfile.count(),
    prisma.customerLocation.count(),
    prisma.vehicle.count(),
    prisma.booking.count(),
    prisma.payment.count(),
    prisma.complaint.count(),
    prisma.notification.count({
      where: {
        userId: {
          not: null,
        },
      },
    }),
    prisma.userSession.count(),
    prisma.pushSubscription.count(),
    prisma.otp.count(),
    prisma.review.count(),
    prisma.wallet.count(),
    prisma.walletTransaction.count(),
    prisma.pendingSignup.count(),
    prisma.emailOtp.count(),
    prisma.phoneOtp.count(),
    prisma.garage.count({
      where: {
        ownerId: {
          not: null,
        },
      },
    }),
    prisma.customerActivity.count(),
    prisma.chatbotConversation.count(),
    prisma.chatbotMessage.count(),
    prisma.supportTicket.count(),
    prisma.supportTicketMessage.count(),
    prisma.supportTicketAttachment.count(),
    prisma.bookingTrackingPoint.count({
      where: {
        userId: {
          not: null,
        },
      },
    }),
    prisma.customerSupportEmailLog.count({
      where: {
        userId: {
          not: null,
        },
      },
    }),
    prisma.systemIssue.count({
      where: {
        userId: {
          not: null,
        },
      },
    }),
  ]);

  return {
    users,
    customerProfiles,
    customerLocations,
    vehicles,
    bookings,
    payments,
    complaints,
    notifications,
    userSessions,
    pushSubscriptions,
    otps,
    reviews,
    wallets,
    walletTransactions,
    pendingSignups,
    emailOtps,
    phoneOtps,
    ownedGarageLinks,
    customerActivities,
    chatbotConversations,
    chatbotMessages,
    supportTickets,
    supportTicketMessages,
    supportTicketAttachments,
    bookingTrackingPoints,
    customerSupportEmailLogsLinkedToUsers,
    systemIssuesLinkedToUsers,
  };
};

const collectBackup = async () => {
  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "asc",
    },
    include: {
      customerProfile: true,
      sessions: true,
      pushSubscriptions: true,
      vehicles: true,
      locations: true,
      customerActivities: true,
      chatbotConversations: {
        include: {
          messages: true,
        },
      },
      bookings: {
        include: {
          services: true,
          payment: true,
          broadcasts: true,
          review: true,
          inspectionImages: true,
          trackingPoints: true,
          adminEvents: true,
          supportTickets: {
            include: {
              messages: true,
              attachments: true,
            },
          },
          complaints: {
            include: {
              images: true,
            },
          },
        },
      },
      complaints: {
        include: {
          images: true,
        },
      },
      notifications: true,
      otps: true,
      wallet: {
        include: {
          transactions: true,
        },
      },
      walletTransactions: true,
      reviews: true,
      supportTickets: {
        include: {
          messages: true,
          attachments: true,
        },
      },
      ownedGarages: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          ownerId: true,
        },
      },
    },
  });

  const userIds = users.map((user) => user.id);
  const emails = users.map((user) => user.email).filter(Boolean);
  const phones = users.map((user) => user.phone).filter(Boolean);

  const pendingSignupOR = [];

  if (emails.length) {
    pendingSignupOR.push({
      email: {
        in: emails,
      },
    });
  }

  if (phones.length) {
    pendingSignupOR.push({
      phone: {
        in: phones,
      },
    });
  }

  const [pendingSignups, emailOtps, phoneOtps, systemIssues, supportEmailLogs] =
    await Promise.all([
      pendingSignupOR.length
        ? prisma.pendingSignup.findMany({
            where: {
              OR: pendingSignupOR,
            },
            orderBy: {
              createdAt: "asc",
            },
          })
        : [],
      emails.length
        ? prisma.emailOtp.findMany({
            where: {
              email: {
                in: emails,
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          })
        : [],
      phones.length
        ? prisma.phoneOtp.findMany({
            where: {
              phone: {
                in: phones,
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          })
        : [],
      userIds.length
        ? prisma.systemIssue.findMany({
            where: {
              userId: {
                in: userIds,
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          })
        : [],
      userIds.length
        ? prisma.customerSupportEmailLog.findMany({
            where: {
              userId: {
                in: userIds,
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          })
        : [],
    ]);

  return {
    exportedAt: new Date().toISOString(),
    note:
      "Backup created before db:nuke-users. Service catalog and garage records are not deleted by the script.",
    users,
    signupArtifacts: {
      pendingSignups,
      emailOtps,
      phoneOtps,
    },
    systemIssues,
    supportEmailLogs,
  };
};

const writeBackup = async () => {
  const backup = await collectBackup();
  const backupDir = getBackupDir();

  fs.mkdirSync(backupDir, {
    recursive: true,
  });

  const backupPath = path.join(
    backupDir,
    `users-backup-${getTimestamp()}.json`,
  );

  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  return {
    backupPath,
    userCount: backup.users.length,
  };
};

const deleteAllUsersData = async () => {
  if (hasFlag("help")) {
    usage();
    return;
  }

  const confirm = hasFlag("confirm");
  const understand = hasFlag("i-understand-delete-all-users");
  const counts = await collectCounts();

  console.log("User data currently in database:");
  console.log(counts);
  console.log(
    "\nPreserved tables: garages, garage media, garage services, services, categories, vehicle metadata, and system issues.",
  );

  if (!confirm || !understand) {
    console.log(
      "\nDry-run only. Re-run with --confirm --i-understand-delete-all-users to create a backup and delete all users.",
    );
    return;
  }

  const { backupPath, userCount } = await writeBackup();
  console.log(`\nBackup saved: ${backupPath}`);

  if (userCount === 0) {
    console.log("No users found. Nothing to delete.");
    return;
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      phone: true,
    },
  });

  const userIds = users.map((user) => user.id);
  const emails = users.map((user) => user.email).filter(Boolean);
  const phones = users.map((user) => user.phone).filter(Boolean);

  await prisma.$transaction(async (tx) => {
    if (emails.length) {
      await tx.emailOtp.deleteMany({
        where: {
          email: {
            in: emails,
          },
        },
      });
    }

    if (phones.length) {
      await tx.phoneOtp.deleteMany({
        where: {
          phone: {
            in: phones,
          },
        },
      });
    }

    const pendingSignupOR = [];

    if (emails.length) {
      pendingSignupOR.push({
        email: {
          in: emails,
        },
      });
    }

    if (phones.length) {
      pendingSignupOR.push({
        phone: {
          in: phones,
        },
      });
    }

    if (pendingSignupOR.length) {
      await tx.pendingSignup.deleteMany({
        where: {
          OR: pendingSignupOR,
        },
      });
    }

    /*
     * SystemIssue userId is a historical scalar reference, not a relation.
     * Preserve issue rows and null the deleted user IDs explicitly.
     */
    await tx.systemIssue.updateMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      data: {
        userId: null,
      },
    });

    await tx.customerSupportEmailLog.updateMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      data: {
        userId: null,
      },
    });

    await tx.garage.updateMany({
      where: {
        ownerId: {
          in: userIds,
        },
      },
      data: {
        ownerId: null,
      },
    });

    await tx.user.deleteMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });
  });

  console.log(`Deleted ${userCount} user(s) and their user-linked data.`);
  console.log(
    "Garages, service catalog data, and system issue history were preserved.",
  );
};

deleteAllUsersData()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
