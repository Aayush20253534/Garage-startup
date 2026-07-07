require("dotenv/config");

const argon2 = require("argon2");
const prisma = require("../config/prisma");

const ADMIN_LOGIN_ID = process.env.ADMIN_LOGIN_ID?.trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME?.trim() || "Rovauto Admin";

const validateEnvironment = () => {
  const missingVariables = [];

  if (!ADMIN_LOGIN_ID) {
    missingVariables.push("ADMIN_LOGIN_ID");
  }

  if (!ADMIN_PASSWORD) {
    missingVariables.push("ADMIN_PASSWORD");
  }

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(", ")}`
    );
  }
};

const seedAdmin = async () => {
  validateEnvironment();

  const normalizedLoginId = ADMIN_LOGIN_ID.toLowerCase();
  const hashedPassword = await argon2.hash(ADMIN_PASSWORD);

  const admin = await prisma.staffAccount.upsert({
    where: {
      loginId: normalizedLoginId,
    },

    update: {
      name: ADMIN_NAME,
      email: null,
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
      passwordChangedAt: new Date(),
    },

    create: {
      name: ADMIN_NAME,
      loginId: normalizedLoginId,
      email: null,
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
      passwordChangedAt: new Date(),
    },

    select: {
      id: true,
      name: true,
      loginId: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log("Admin staff account seeded successfully:");
  console.log(admin);
};

seedAdmin()
  .catch((error) => {
    console.error("Failed to seed admin staff account:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });