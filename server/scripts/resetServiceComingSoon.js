const prisma = require("../src/config/prisma");

const main = async () => {
  const result = await prisma.service.updateMany({
    data: {
      isComingSoon: false,
    },
  });

  console.log(
    `Reset isComingSoon=false for ${result.count} service${result.count === 1 ? "" : "s"}.`,
  );
};

main()
  .catch((error) => {
    console.error("Unable to reset service flags:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
