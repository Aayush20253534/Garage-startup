require("dotenv/config");

const argon2 = require("argon2");
const prisma = require("../config/prisma");

const ADMIN_LOGIN_ID = "Admin";
const ADMIN_EMAIL = ADMIN_LOGIN_ID.toLowerCase();
const ADMIN_PASSWORD = "Rovauto@03";

const seedAdmin = async () => {
  const password = await argon2.hash(ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: {
      email_role: {
        email: ADMIN_EMAIL,
        role: "ADMIN",
      },
    },
    update: {
      name: "Admin",
      password,
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      isOnboarded: true,
    },
    create: {
      name: "Admin",
      email: ADMIN_EMAIL,
      password,
      role: "ADMIN",
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      isOnboarded: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  console.log("Admin user seeded successfully:");
  console.log({
    ...admin,
    loginId: ADMIN_LOGIN_ID,
    password: ADMIN_PASSWORD,
  });
};

seedAdmin()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });