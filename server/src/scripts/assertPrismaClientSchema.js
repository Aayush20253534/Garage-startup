const prismaClient = require("@prisma/client");
const { Prisma } = prismaClient;

const REQUIRED_SERVICE_FIELDS = [
  "id",
  "categoryId",
  "name",
  "description",
  "isActive",
  "isComingSoon",
  "fulfillmentType",
  "createdAt",
  "updatedAt",
  "durationMin",
];

const REMOVED_SERVICE_PRICE_FIELDS = ["basePrice", "minPrice", "maxPrice"];

const serviceModel = Prisma.dmmf.datamodel.models.find(
  (model) => model.name === "Service",
);
const garageModel = Prisma.dmmf.datamodel.models.find(
  (model) => model.name === "Garage",
);
const bookingModel = Prisma.dmmf.datamodel.models.find(
  (model) => model.name === "Booking",
);

if (!serviceModel || !garageModel || !bookingModel) {
  const missingModels = [
    !serviceModel ? "Service" : null,
    !garageModel ? "Garage" : null,
    !bookingModel ? "Booking" : null,
  ]
    .filter(Boolean)
    .join(", ");

  throw new Error(
    `Generated Prisma Client is invalid: missing model(s): ${missingModels}. Run \`npm run prisma:generate\`.`,
  );
}

const generatedFields = new Set(serviceModel.fields.map((field) => field.name));
const generatedGarageFields = new Set(
  garageModel.fields.map((field) => field.name),
);
const missingFields = REQUIRED_SERVICE_FIELDS.filter(
  (field) => !generatedFields.has(field),
);
const missingGarageFields = ["fulfillmentMode"].filter(
  (field) => !generatedGarageFields.has(field),
);
const staleFields = REMOVED_SERVICE_PRICE_FIELDS.filter((field) =>
  generatedFields.has(field),
);

const serviceFulfillmentField = serviceModel.fields.find(
  (field) => field.name === "fulfillmentType",
);
const bookingFulfillmentField = bookingModel.fields.find(
  (field) => field.name === "fulfillmentType",
);
const fulfillmentEnum = Prisma.dmmf.datamodel.enums?.find(
  (item) => item.name === "ServiceFulfillmentType",
);

const enumValues = (candidate) => {
  if (!candidate || typeof candidate !== "object") return [];

  return Object.values(candidate)
    .map((value) => {
      if (typeof value === "string") return value;
      if (value && typeof value.name === "string") return value.name;
      return null;
    })
    .filter(Boolean);
};

// Prisma 7 no longer guarantees that user-defined enum values are exposed in
// Prisma.dmmf.datamodel.enums. The generated runtime enum is the stable source
// for prisma-client-js, while the DMMF lookup is retained as a compatibility
// fallback for older generated clients.
const generatedFulfillmentValues = new Set([
  ...enumValues(prismaClient.ServiceFulfillmentType),
  ...enumValues(prismaClient.$Enums?.ServiceFulfillmentType),
  ...enumValues(Prisma.ServiceFulfillmentType),
  ...enumValues(fulfillmentEnum?.values),
]);
const requiredFulfillmentValues = [
  "BOTH",
  "PICKUP_DELIVERY",
  "SELF_DROP_OFF",
];
const missingFulfillmentValues = requiredFulfillmentValues.filter(
  (value) => !generatedFulfillmentValues.has(value),
);
const fulfillmentTypeErrors = [
  serviceFulfillmentField?.type !== "ServiceFulfillmentType"
    ? `Service.fulfillmentType uses ${serviceFulfillmentField?.type || "no enum"}`
    : null,
  bookingFulfillmentField?.type !== "ServiceFulfillmentType"
    ? `Booking.fulfillmentType uses ${bookingFulfillmentField?.type || "no enum"}`
    : null,
  missingFulfillmentValues.length > 0
    ? `ServiceFulfillmentType is missing: ${missingFulfillmentValues.join(", ")}`
    : null,
].filter(Boolean);

if (
  missingFields.length > 0 ||
  missingGarageFields.length > 0 ||
  staleFields.length > 0 ||
  fulfillmentTypeErrors.length > 0
) {
  const details = [
    missingFields.length > 0
      ? `missing current fields: ${missingFields.join(", ")}`
      : null,
    missingGarageFields.length > 0
      ? `Garage is missing current fields: ${missingGarageFields.join(", ")}`
      : null,
    staleFields.length > 0
      ? `still contains removed fields: ${staleFields.join(", ")}`
      : null,
    fulfillmentTypeErrors.length > 0
      ? fulfillmentTypeErrors.join("; ")
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
