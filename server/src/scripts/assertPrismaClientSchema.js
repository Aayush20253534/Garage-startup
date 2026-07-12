const { Prisma } = require("@prisma/client");

const REQUIRED_SERVICE_FIELDS = [
  "id",
  "categoryId",
  "name",
  "description",
  "isActive",
  "isComingSoon",
  "createdAt",
  "updatedAt",
  "durationMin",
];

const REMOVED_SERVICE_PRICE_FIELDS = ["basePrice", "minPrice", "maxPrice"];

const serviceModel = Prisma.dmmf.datamodel.models.find(
  (model) => model.name === "Service",
);

if (!serviceModel) {
  throw new Error(
    "Generated Prisma Client is invalid: the Service model is missing. Run `npm run prisma:generate`.",
  );
}

const generatedFields = new Set(serviceModel.fields.map((field) => field.name));
const missingFields = REQUIRED_SERVICE_FIELDS.filter(
  (field) => !generatedFields.has(field),
);
const staleFields = REMOVED_SERVICE_PRICE_FIELDS.filter((field) =>
  generatedFields.has(field),
);

if (missingFields.length > 0 || staleFields.length > 0) {
  const details = [
    missingFields.length > 0
      ? `missing current fields: ${missingFields.join(", ")}`
      : null,
    staleFields.length > 0
      ? `still contains removed fields: ${staleFields.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("; ");

  throw new Error(
    `Generated Prisma Client does not match prisma/schema.prisma (${details}). ` +
      "Delete node_modules/.prisma, run `npm run prisma:generate`, and redeploy without the old build cache.",
  );
}

console.log("Prisma Client schema check passed.");
