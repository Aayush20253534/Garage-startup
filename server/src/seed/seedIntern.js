require("dotenv/config");

const argon2 = require("argon2");
const prisma = require("../config/prisma");

const INTERN_LOGIN_ID = "INTERN-ROVAUTO";
const INTERN_EMAIL = INTERN_LOGIN_ID.toLowerCase();
const INTERN_PASSWORD = "Intern@2026Rovauto";

const seedIntern = async () => {
  const password = await argon2.hash(INTERN_PASSWORD);

  const intern = await prisma.user.upsert({
    where: {
      email_role: {
        email: INTERN_EMAIL,
        role: "INTERN",
      },
    },
    update: {
      name: "Rovauto Intern",
      password,
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      isOnboarded: true,
    },
    create: {
      name: "Rovauto Intern",
      email: INTERN_EMAIL,
      password,
      role: "INTERN",
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

  console.log("Intern user seeded successfully:");
  console.log({
    ...intern,
    loginId: INTERN_LOGIN_ID,
    password: INTERN_PASSWORD,
  });
};

seedIntern()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
