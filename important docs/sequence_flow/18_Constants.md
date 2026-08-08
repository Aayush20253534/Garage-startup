# 18. Constants Reference

## 1. Executive Summary

System constants and status enumerations are centralized in [`server/src/constants/`](file:///Users/prateek/Roavuto/server/src/constants). Using predefined constant objects instead of magic strings ensures type safety and consistency across controllers, services, and middlewares.

---

## 2. Master System Constants Table

| Constant File | Variable Export | Defined Enum Values & Descriptions |
| :--- | :--- | :--- |
| [`roles.js`](file:///Users/prateek/Roavuto/server/src/constants/roles.js) | `ROLES` | `CUSTOMER: "CUSTOMER"`, `GARAGE_OWNER: "GARAGE_OWNER"`, `GARAGE_CONTROLLER: "GARAGE_CONTROLLER"`, `ADMIN: "ADMIN"` |
| [`bookingStatus.js`](file:///Users/prateek/Roavuto/server/src/constants/bookingStatus.js) | `BOOKING_STATUS` | `PENDING_GARAGE_ASSIGNMENT`, `GARAGE_ACCEPTED`, `PICKUP_IN_PROGRESS`, `SELF_DROP_OFF`, `VEHICLE_IN_GARAGE`, `WORK_IN_PROGRESS`, `WORK_COMPLETED`, `RETURN_IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `EXPIRED` |
| [`paymentStatus.js`](file:///Users/prateek/Roavuto/server/src/constants/paymentStatus.js) | `PAYMENT_STATUS` | `CREATED: "CREATED"`, `PENDING: "PENDING"`, `PAID: "PAID"`, `FAILED: "FAILED"`, `REFUNDED: "REFUNDED"` |
| [`complaintStatus.js`](file:///Users/prateek/Roavuto/server/src/constants/complaintStatus.js) | `COMPLAINT_STATUS` | `OPEN: "OPEN"`, `IN_PROGRESS: "IN_PROGRESS"`, `RESOLVED: "RESOLVED"`, `REJECTED: "REJECTED"` |
| [`broadcastStatus.js`](file:///Users/prateek/Roavuto/server/src/constants/broadcastStatus.js) | `BROADCAST_STATUS` | `SENT: "SENT"`, `ACCEPTED: "ACCEPTED"`, `REJECTED: "REJECTED"`, `EXPIRED: "EXPIRED"` |
| [`fuelTypes.js`](file:///Users/prateek/Roavuto/server/src/constants/fuelTypes.js) | `FUEL_TYPES` | `PETROL: "PETROL"`, `DIESEL: "DIESEL"`, `CNG: "CNG"`, `EV: "EV"` |
| [`serviceFulfillmentType.js`](file:///Users/prateek/Roavuto/server/src/constants/serviceFulfillmentType.js) | `SERVICE_FULFILLMENT_TYPES` | `PICKUP_AND_DROP: "PICKUP_AND_DROP"`, `SELF_DROP_OFF: "SELF_DROP_OFF"`, `DOORSTEP: "DOORSTEP"` |
| [`walletTransactionType.js`](file:///Users/prateek/Roavuto/server/src/constants/walletTransactionType.js) | `WALLET_TRANSACTION_TYPES` | `DEPOSIT: "DEPOSIT"`, `WITHDRAWAL: "WITHDRAWAL"`, `BOOKING_PAYMENT: "BOOKING_PAYMENT"`, `REFUND: "REFUND"`, `EARNING: "EARNING"` |
| [`walletTransactionStatus.js`](file:///Users/prateek/Roavuto/server/src/constants/walletTransactionStatus.js) | `WALLET_TRANSACTION_STATUS` | `PENDING: "PENDING"`, `SUCCESS: "SUCCESS"`, `FAILED: "FAILED"` |
