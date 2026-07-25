const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("sub-admin accounts reuse staff authentication with email OTP and password recovery", () => {
  const schema = read("server/prisma/schema.prisma");
  const authService = read("server/src/customer/services/auth.service.js");
  const validation = read("server/src/customer/validations/auth.validation.js");
  const otpRules = read("server/src/customer/security/staffTwoFactorRules.js");
  const accountRoutes = read("server/src/admin/routes/subAdminAccount.routes.js");
  const accountService = read("server/src/admin/services/subAdminAccount.service.js");
  const passwordResetService = read("server/src/customer/services/staffPasswordReset.service.js");

  assert.match(schema, /enum StaffRole[\s\S]*SUB_ADMIN/);
  assert.match(schema, /createdById\s+String\?/);
  assert.match(authService, /STAFF_ROLES = \["ADMIN", "SUB_ADMIN", "INTERN"\]/);
  assert.match(authService, /role: requestedRole/);
  assert.match(authService, /action: "LOGIN_SUCCEEDED"/);
  assert.match(authService, /action: "PASSWORD_RESET_SELF"/);
  assert.match(validation, /PASSWORD_RECOVERY_ROLES = \[\.\.\.USER_ROLES, "GARAGE_CONTROLLER", "SUB_ADMIN", "INTERN"\]/);
  assert.match(otpRules, /role === "ADMIN" \? getAdminDeliveryEmail\(\) : normalizeEmail\(email\)/);
  assert.match(accountRoutes, /router\.use\(authorizeRoles\("ADMIN", "SUB_ADMIN"\)\)/);
  assert.match(accountService, /role: "SUB_ADMIN"/);
  assert.match(accountService, /loginId: normalizedEmail/);
  assert.match(accountService, /staffSession\.updateMany/);
  assert.match(passwordResetService, /String\(role \|\| "staff"\)/);
});

test("sub-admins match admin access everywhere except dangerous commands", () => {
  const operations = read("server/src/admin/routes/adminOperations.routes.js");
  const priceRoutes = read("server/src/admin/routes/cityServicePriceRange.routes.js");
  const carRoutes = read("server/src/admin/routes/carMeta.routes.js");
  const garageRoutes = read("server/src/admin/routes/garageAdmin.routes.js");
  const dangerousRoutes = read("server/src/admin/routes/dangerous.routes.js");
  const controllerService = read("server/src/garage/services/controller.service.js");
  const operationalService = read("server/src/admin/services/garageOperational.service.js");

  assert.match(operations, /"\/bookings\/:bookingId\/status"[\s\S]*authorizeRoles\("ADMIN", "SUB_ADMIN"\)/);
  assert.match(operations, /"\/bookings\/:bookingId\/manual-override"[\s\S]*authorizeRoles\("ADMIN", "SUB_ADMIN"\)/);
  assert.match(operations, /"\/bookings\/all"[\s\S]*authorizeRoles\("ADMIN", "SUB_ADMIN"\)/);
  assert.match(operations, /"\/wallet-transfers"[\s\S]*authorizeRoles\("ADMIN", "SUB_ADMIN"\)/);
  assert.match(priceRoutes, /"\/submissions\/:id\/review"[\s\S]*authorizeRoles\("ADMIN", "SUB_ADMIN"\)/);
  assert.match(priceRoutes, /router\.delete\([\s\S]*"\/"[\s\S]*authorizeRoles\("ADMIN", "SUB_ADMIN"\)[\s\S]*deletePriceRanges/);
  assert.match(carRoutes, /router\.delete\("\/models\/:modelId", authorizeRoles\("ADMIN", "SUB_ADMIN"\)/);
  assert.match(garageRoutes, /router\.delete\([\s\S]*"\/"[\s\S]*authorizeRoles\("ADMIN", "SUB_ADMIN"\)[\s\S]*deleteGarages/);
  assert.match(dangerousRoutes, /router\.use\(authorizeRoles\("ADMIN"\)\)/);
  assert.match(controllerService, /\["ADMIN", "SUB_ADMIN"\]\.includes\(actor\?\.role\)/);
  assert.match(operationalService, /PERMANENTLY_BLOCKED" && !\["ADMIN", "SUB_ADMIN"\]\.includes\(staff\?\.role\)/);
});

test("booking events and reassignment history are persisted with actor identity", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260724113000_add_sub_admin_booking_timeline/migration.sql",
  );
  const service = read("server/src/admin/services/adminOperations.service.js");
  const actorContext = read("server/src/admin/services/bookingActorContext.service.js");

  assert.match(schema, /model BookingEvent/);
  assert.match(schema, /model BookingReassignment/);
  assert.match(schema, /events\s+BookingEvent\[\]/);
  assert.match(schema, /reassignments\s+BookingReassignment\[\]/);
  assert.match(migration, /CREATE TRIGGER rovauto_booking_events_trigger/);
  assert.match(migration, /CREATE TRIGGER rovauto_broadcast_events_trigger/);
  assert.match(migration, /CREATE TRIGGER rovauto_payment_events_trigger/);
  assert.match(migration, /CREATE TRIGGER rovauto_booking_service_events_trigger/);
  assert.match(migration, /CREATE TRIGGER rovauto_inspection_events_trigger/);
  assert.match(migration, /CREATE TRIGGER rovauto_complaint_events_trigger/);
  assert.match(migration, /CREATE TRIGGER rovauto_review_events_trigger/);
  assert.match(migration, /CREATE TRIGGER rovauto_support_ticket_events_trigger/);
  assert.match(migration, /CREATE TRIGGER rovauto_support_message_events_trigger/);
  assert.match(migration, /CREATE TRIGGER rovauto_wallet_booking_events_trigger/);
  assert.match(migration, /Historical booking imported/);
  assert.match(migration, /TG_OP = 'DELETE' AND NOT EXISTS/);
  assert.match(actorContext, /rovauto\.actor_name/);
  assert.match(actorContext, /rovauto\.actor_role/);
  assert.match(service, /bookingReassignment\.create/);
  assert.match(service, /customerNotified: true/);
  assert.match(service, /events:\s*\{[\s\S]*take: 500/);
});

test("manual booking overrides require a reason and submit only changed values", () => {
  const routes = read("server/src/admin/routes/adminOperations.routes.js");
  const validation = read("server/src/admin/validations/adminOperations.validation.js");
  const service = read("server/src/admin/services/adminOperations.service.js");
  const modal = read("client/src/components/admin/BookingManagementModal.jsx");

  assert.match(routes, /"\/bookings\/:bookingId\/manual-override"/);
  assert.match(validation, /body\("reason"\)[\s\S]*isLength\(\{ min: 5, max: 1000 \}\)/);
  assert.match(validation, /body\("servicePrices"\)\.optional\(\)\.isArray/);
  assert.match(service, /A clear override reason is required/);
  assert.match(service, /setBookingActorContext\(tx, staff\)/);
  assert.match(service, /action: "MANUAL_OVERRIDE"/);
  assert.match(service, /eventType: "MANUAL_OVERRIDE"/);
  assert.match(modal, /overrideInitial/);
  assert.match(modal, /changedServicePrices/);
  assert.match(modal, /Change at least one field before saving the override/);
  assert.match(modal, /Garage reassignment history/);
});

test("admin portal distinguishes staff login and guards only the dangerous page", () => {
  const login = read("client/src/pages/admin/Login.jsx");
  const forgot = read("client/src/pages/admin/ForgotPassword.jsx");
  const accounts = read("client/src/pages/admin/SubAdminAccounts.jsx");
  const app = read("client/src/App.jsx");
  const layout = read("client/src/layouts/DashboardLayout.jsx");

  assert.match(login, /Main admin/);
  assert.match(login, /Sub admin/);
  assert.match(login, /expectedRole=\{selectedRole\}/);
  assert.match(login, /\/admin\/forgot-password/);
  assert.match(forgot, /requestSubAdminPasswordReset/);
  assert.match(forgot, /resetSubAdminPassword/);
  assert.match(accounts, /Create sub-admin/);
  assert.match(app, /function ProtectedRoute\(\{ children, mainAdminOnly = false \}\)/);
  assert.equal((app.match(/<ProtectedRoute mainAdminOnly>/g) || []).length, 1);
  assert.match(app, /path="\/admin\/dangerous"[\s\S]*<ProtectedRoute mainAdminOnly>/);
  assert.doesNotMatch(app, /path="\/admin\/(?:customer-support-accounts|intern-accounts|sub-admin-accounts)"[\s\S]{0,120}<ProtectedRoute mainAdminOnly>/);
  assert.match(layout, /item\.mainAdminOnly/);
});
