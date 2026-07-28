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
const bookingInspectionModel = Prisma.dmmf.datamodel.models.find(
  (model) => model.name === "BookingInspectionImage",
);
const garageWorkerTaskModel = Prisma.dmmf.datamodel.models.find(
  (model) => model.name === "GarageWorkerTask",
);

if (
  !serviceModel ||
  !garageModel ||
  !bookingModel ||
  !bookingInspectionModel ||
  !garageWorkerTaskModel
) {
  const missingModels = [
    !serviceModel ? "Service" : null,
    !garageModel ? "Garage" : null,
    !bookingModel ? "Booking" : null,
    !bookingInspectionModel ? "BookingInspectionImage" : null,
    !garageWorkerTaskModel ? "GarageWorkerTask" : null,
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
const missingGarageFields = [
  "fulfillmentMode",
  "controllerAccountsEnabled",
].filter(
  (field) => !generatedGarageFields.has(field),
);
const generatedInspectionFields = new Set(
  bookingInspectionModel.fields.map((field) => field.name),
);
const missingInspectionFields = ["mediaType"].filter(
  (field) => !generatedInspectionFields.has(field),
);
const staleFields = REMOVED_SERVICE_PRICE_FIELDS.filter((field) =>
  generatedFields.has(field),
);
const generatedWorkerTaskFields = new Set(
  garageWorkerTaskModel.fields.map((field) => field.name),
);
const missingWorkerTaskFields = [
  "bookingId",
  "garageId",
  "requestId",
  "taskType",
  "status",
  "workerPhone",
  "tokenHash",
  "expiresAt",
].filter((field) => !generatedWorkerTaskFields.has(field));

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

const inspectionMediaField = bookingInspectionModel.fields.find(
  (field) => field.name === "mediaType",
);
const inspectionMediaEnum = Prisma.dmmf.datamodel.enums?.find(
  (item) => item.name === "BookingInspectionMediaType",
);
const generatedInspectionMediaValues = new Set([
  ...enumValues(prismaClient.BookingInspectionMediaType),
  ...enumValues(prismaClient.$Enums?.BookingInspectionMediaType),
  ...enumValues(Prisma.BookingInspectionMediaType),
  ...enumValues(inspectionMediaEnum?.values),
]);
const missingInspectionMediaValues = ["IMAGE", "VIDEO"].filter(
  (value) => !generatedInspectionMediaValues.has(value),
);
const inspectionMediaErrors = [
  inspectionMediaField?.type !== "BookingInspectionMediaType"
    ? `BookingInspectionImage.mediaType uses ${inspectionMediaField?.type || "no enum"}`
    : null,
  missingInspectionMediaValues.length > 0
    ? `BookingInspectionMediaType is missing: ${missingInspectionMediaValues.join(", ")}`
    : null,
].filter(Boolean);
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
  missingInspectionFields.length > 0 ||
  missingWorkerTaskFields.length > 0 ||
  staleFields.length > 0 ||
  fulfillmentTypeErrors.length > 0 ||
  inspectionMediaErrors.length > 0
) {
  const details = [
    missingFields.length > 0
      ? `missing current fields: ${missingFields.join(", ")}`
      : null,
    missingGarageFields.length > 0
      ? `Garage is missing current fields: ${missingGarageFields.join(", ")}`
      : null,
    missingInspectionFields.length > 0
      ? `BookingInspectionImage is missing current fields: ${missingInspectionFields.join(", ")}`
      : null,
    missingWorkerTaskFields.length > 0
      ? `GarageWorkerTask is missing current fields: ${missingWorkerTaskFields.join(", ")}`
      : null,
    staleFields.length > 0
      ? `still contains removed fields: ${staleFields.join(", ")}`
      : null,
    fulfillmentTypeErrors.length > 0
      ? fulfillmentTypeErrors.join("; ")
      : null,
    inspectionMediaErrors.length > 0
      ? inspectionMediaErrors.join("; ")
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
