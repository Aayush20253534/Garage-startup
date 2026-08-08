# 10. Validation Architecture

## 1. Executive Summary

The Rovauto backend uses a **dual validation model**:
1. **Route-Level Input Validation**: Implemented via **`express-validator` (v7.3.2)** as express middleware before controller execution.
2. **Internal Schema & Data Transformations**: Implemented via **`zod` (v4.4.3)** for service layer DTO parsing and configuration validation.

---

## 2. Validation Execution Flow

```mermaid
flowchart TD
    Req[Incoming HTTP Request] --> Route[Router Definition]
    Route --> Rules[Express-Validator Validation Array]
    Rules --> ValMw["validate (validate.middleware.js)"]
    ValMw --> Result{validationResult(req).isEmpty()}
    Result -- Yes --> Ctrl[Execute Controller Action]
    Result -- No --> FormatErr[Format Field Error Objects]
    FormatErr --> ResErr["Return 400 Bad Request (ApiError)"]
```

---

## 3. Standard Field Validators & Helpers

Common field validation rules are standardized across all module validation files:

| Field Target | Validation Rules & Sanitization | Error Message |
| :--- | :--- | :--- |
| **Email** | `body("email").trim().isEmail().normalizeEmail()` | `"Please provide a valid email address"` |
| **Indian Phone** | `body("phone").trim().matches(/^[6-9]\d{9}$/)` | `"Please enter a valid 10-digit Indian phone number starting with 6-9"` |
| **UUID (v4)** | `param("id").trim().isUUID(4)` | `"Invalid resource ID format"` |
| **Latitude** | `body("latitude").isFloat({ min: -90, max: 90 })` | `"Latitude must be between -90 and 90"` |
| **Longitude** | `body("longitude").isFloat({ min: -180, max: 180 })` | `"Longitude must be between -180 and 180"` |
| **Price (Paise/INR)**| `body("price").isInt({ min: 0 })` | `"Price must be a non-negative integer"` |
| **Pincode** | `body("pincode").trim().matches(/^\d{6}$/)` | `"Please enter a valid 6-digit postal code"` |

---

## 4. Module Validation File Inventory

| Validation File Path | Covered Routes & Payload Types | Key Rules & Constraints |
| :--- | :--- | :--- |
| [`customer/validations/auth.validation.js`](file:///Users/prateek/Roavuto/server/src/customer/validations/auth.validation.js) | Customer Signup, Login, Password Reset | Min 8 char password, strength regex, phone OTP format. |
| [`customer/validations/booking.validation.js`](file:///Users/prateek/Roavuto/server/src/customer/validations/booking.validation.js) | Booking Creation, Cancellation | Validates `vehicleId`, `locationId`, service array non-empty, future scheduled date. |
| [`garage/validations/application.validation.js`](file:///Users/prateek/Roavuto/server/src/garage/validations/application.validation.js) | Garage Onboarding Submissions | Validates owner name, garage name, address, working radius (1-50 km). |
| [`admin/validations/cityServicePriceRange.validation.js`](file:///Users/prateek/Roavuto/server/src/admin/validations/cityServicePriceRange.validation.js) | Price Range Overrides | Asserts `minPrice <= maxPrice`, valid brand/model strings. |
| [`validations/systemIssue.validation.js`](file:///Users/prateek/Roavuto/server/src/validations/systemIssue.validation.js) | System Issue Submissions | Validates issue title, severity enum, stack trace string length. |

---

## 5. Standardized Error Response Format

When validation fails in [`validate.middleware.js`](file:///Users/prateek/Roavuto/server/src/middlewares/validate.middleware.js), the server responds immediately with HTTP `400 Bad Request`:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "phone",
      "message": "Please enter a valid 10-digit Indian phone number starting with 6-9"
    },
    {
      "field": "latitude",
      "message": "Latitude must be between -90 and 90"
    }
  ]
}
```
