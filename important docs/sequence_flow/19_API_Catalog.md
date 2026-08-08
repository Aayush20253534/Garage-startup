# 19. Complete API Catalog

## 1. Executive Summary

This document serves as the single comprehensive catalog of all REST API endpoints exposed by the Rovauto backend under `/api/v1`.

---

## 2. Master API Endpoint Catalog Table

| Method | Endpoint Route | Description | Auth Requirement | Controller Method | Target Service Layer | Related Database Tables | HTTP Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/signup` | Register new customer account | Public | `authController.signup` | `authService.signupCustomer` | `User`, `CustomerProfile`, `Wallet` | 201, 400, 409 |
| `POST` | `/api/v1/auth/login` | Authenticate customer with email/password | Public | `authController.login` | `authService.loginCustomer` | `User`, `UserSession` | 200, 400, 401 |
| `POST` | `/api/v1/auth/send-otp` | Send phone OTP code | Public (Rate Limited) | `authController.sendPhoneOtp` | `otpService.sendOtp` | `PhoneOtp` | 200, 400, 429 |
| `POST` | `/api/v1/auth/verify-otp` | Verify phone OTP & login/signup | Public | `authController.verifyPhoneOtp` | `authService.verifyOtpAndLogin` | `User`, `PhoneOtp`, `UserSession` | 200, 400, 401 |
| `POST` | `/api/v1/auth/logout` | Revoke session & clear cookie | Session Cookie | `authController.logout` | `authService.logoutCustomer` | `UserSession` | 200, 401 |
| `POST` | `/api/v1/auth/refresh-token` | Refresh expired access JWT | Session Cookie | `authController.refreshToken` | `authService.refreshCustomerToken` | `UserSession` | 200, 401 |
| `GET` | `/api/v1/cities` | List active service cities | Public | `cityController.getCities` | `cityService.getAllCities` | `City` | 200 |
| `GET` | `/api/v1/services` | Get service catalog & categories | Public | `serviceController.getServices` | `serviceService.getServices` | `ServiceCategory`, `Service` | 200 |
| `GET` | `/api/v1/vehicle-meta/brands` | List vehicle brands & models | Public | `vehicleMetaController.getBrands` | `vehicleMetaService.getBrands` | `VehicleBrand`, `VehicleModel` | 200 |
| `GET` | `/api/v1/garages/nearby` | Spatial search for nearby garages | Public / Customer | `garageController.getNearbyGarages` | `garageService.findNearbyGarages` | `Garage`, `GarageService` | 200, 400 |
| `GET` | `/api/v1/garages/:id` | Get detailed garage profile | Public / Customer | `garageController.getGarageById` | `garageService.getGarageDetails` | `Garage`, `GarageImage`, `Review` | 200, 404 |
| `POST` | `/api/v1/garage/applications` | Submit garage partner application | Public | `garageAppController.submit` | `garageAppService.submitApp` | `GarageApplication`, `Outbox` | 201, 400 |
| `POST` | `/api/v1/vehicles` | Add new vehicle to customer garage | `CUSTOMER` | `vehicleController.addVehicle` | `vehicleService.addVehicle` | `Vehicle` | 201, 400 |
| `GET` | `/api/v1/vehicles` | List customer saved vehicles | `CUSTOMER` | `vehicleController.getVehicles` | `vehicleService.getUserVehicles` | `Vehicle` | 200 |
| `POST` | `/api/v1/bookings` | Create new service booking | `CUSTOMER` | `bookingController.createBooking` | `bookingLifecycle.initiateProcess` | `Booking`, `BroadcastRequest` | 201, 400, 404 |
| `GET` | `/api/v1/bookings` | List customer booking history | `CUSTOMER` | `bookingController.getUserBookings` | `bookingService.getUserBookings` | `Booking`, `Garage` | 200 |
| `GET` | `/api/v1/bookings/:id` | Get booking details & tracking | `CUSTOMER` | `bookingController.getBookingById` | `bookingService.getBookingDetails` | `Booking`, `TrackingPoint` | 200, 404 |
| `POST` | `/api/v1/bookings/:id/cancel` | Cancel active booking | `CUSTOMER` | `bookingController.cancelBooking` | `bookingLifecycle.cancelBooking` | `Booking`, `WalletTransaction` | 200, 400 |
| `POST` | `/api/v1/payments/create-order` | Initiate Cashfree PG order | `CUSTOMER` | `paymentController.createOrder` | `paymentService.createOrder` | `Payment` | 200, 400 |
| `POST` | `/api/v1/webhooks/cashfree` | Cashfree webhook settlement | Webhook HMAC | `paymentWebhook.handleWebhook` | `paymentService.processWebhook` | `Payment`, `Booking`, `Wallet` | 200, 400 |
| `GET` | `/api/v1/wallet` | Get customer wallet balance | `CUSTOMER` | `walletController.getWallet` | `walletService.getWallet` | `Wallet`, `WalletTransaction` | 200 |
| `POST` | `/api/v1/wallet/deposit` | Add funds to customer wallet | `CUSTOMER` | `walletController.deposit` | `walletService.depositFunds` | `Wallet`, `WalletTransaction` | 200, 400 |
| `GET` | `/api/v1/garage/requests/pending` | List active broadcast offers | `GARAGE_OWNER` / `CONTROLLER` | `garageReqController.getPending` | `garageReqService.getPending` | `GarageBroadcastRequest` | 200 |
| `POST` | `/api/v1/garage/requests/:id/accept`| Accept broadcast booking offer | `GARAGE_OWNER` / `CONTROLLER` | `garageReqController.accept` | `garageReqService.acceptRequest` | `Booking`, `BroadcastRequest` | 200, 409 |
| `POST` | `/api/v1/garage/worker-tasks` | Create tokenized worker task | `GARAGE_OWNER` / `CONTROLLER` | `workerTaskController.create` | `workerTaskService.createTask` | `GarageWorkerTask` | 201, 400 |
| `GET` | `/api/v1/worker-tasks/:token` | Public worker task details | Public (Token) | `publicWorkerTask.getTask` | `workerTaskService.getByToken` | `GarageWorkerTask` | 200, 404 |
| `POST` | `/api/v1/worker-tasks/:token/location`| Post worker GPS tracking point | Public (Token) | `publicWorkerTask.postLocation`| `workerTaskService.addTrackPoint`| `BookingTrackingPoint` | 200, 400 |
| `GET` | `/api/v1/admin/control-center/overview`| Admin overview stats | `ADMIN` / `SUB_ADMIN` | `adminControlController.getOverview`| `adminService.getOverviewStats` | All Tables | 200 |
| `POST` | `/api/v1/admin/garage-applications/:id/approve`| Approve garage application | `ADMIN` / `SUB_ADMIN` | `adminGarageAppController.approve`| `garageAppService.approveApp` | `Garage`, `GarageOwner` | 200, 404 |
