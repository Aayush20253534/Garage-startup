require("dotenv/config");

const argon2 = require("argon2");
const prisma = require("../config/prisma");

const INTERN_LOGIN_ID = process.env.INTERN_LOGIN_ID?.trim();
const INTERN_PASSWORD = process.env.INTERN_PASSWORD;
const INTERN_NAME = process.env.INTERN_NAME?.trim() || "Rovauto Intern";

const validateEnvironment = () => {
  const missingVariables = [];

  if (!INTERN_LOGIN_ID) {
    missingVariables.push("INTERN_LOGIN_ID");
  }

  if (!INTERN_PASSWORD) {
    missingVariables.push("INTERN_PASSWORD");
  }

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(", ")}`
    );
  }
};

const seedIntern = async () => {
  validateEnvironment();

  const normalizedLoginId = INTERN_LOGIN_ID.toLowerCase();
  const hashedPassword = await argon2.hash(INTERN_PASSWORD);

  const intern = await prisma.staffAccount.upsert({
    where: {
      loginId: normalizedLoginId,
    },

    update: {
      name: INTERN_NAME,
      email: null,
      password: hashedPassword,
      role: "INTERN",
      isActive: true,
      passwordChangedAt: new Date(),
    },

    create: {
      name: INTERN_NAME,
      loginId: normalizedLoginId,
      email: null,
      password: hashedPassword,
      role: "INTERN",
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

  console.log("Intern staff account seeded successfully:");
  console.log(intern);
};

seedIntern()
  .catch((error) => {
    console.error("Failed to seed intern staff account:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });