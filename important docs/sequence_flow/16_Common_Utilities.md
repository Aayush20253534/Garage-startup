# 16. Common Utilities Reference

## 1. Executive Summary

The [`server/src/utils/`](file:///Users/prateek/Roavuto/server/src/utils) directory contains 24 pure utility modules and helpers. These utilities provide common services across all domains while remaining strictly decoupled from controller or router dependencies.

---

## 2. Complete Inventory of Utility Modules

| Utility File | Purpose & Responsibilities | Key Functions / Signatures |
| :--- | :--- | :--- |
| [`apiError.js`](file:///Users/prateek/Roavuto/server/src/utils/apiError.js) | Custom Operational Error Class extending standard `Error`. | `new ApiError(statusCode, message, errors = [], stack = "")` |
| [`apiResponse.js`](file:///Users/prateek/Roavuto/server/src/utils/apiResponse.js) | Standardized API JSON Response Formatter. | `new ApiResponse(statusCode, data, message = "Success")` |
| [`asyncHandler.js`](file:///Users/prateek/Roavuto/server/src/utils/asyncHandler.js) | Express Async Wrapper executing functions inside `Promise.resolve().catch(next)`. | `asyncHandler(fn) => (req, res, next)` |
| [`cache.js`](file:///Users/prateek/Roavuto/server/src/utils/cache.js) | Redis caching wrapper with JSON serialization & cache stampede mitigation. | `getOrSetCache(key, ttlSeconds, fetchFn)` |
| [`cloudinaryUpload.js`](file:///Users/prateek/Roavuto/server/src/utils/cloudinaryUpload.js) | Streams buffer to Cloudinary using `streamifier`. | `uploadToCloudinary(buffer, options)` |
| [`cloudinaryCleanup.js`](file:///Users/prateek/Roavuto/server/src/utils/cloudinaryCleanup.js) | Deletes Cloudinary media by public ID. | `deleteFromCloudinary(publicId)` |
| [`distance.js`](file:///Users/prateek/Roavuto/server/src/utils/distance.js) | Computes Haversine distance in kilometers. | `calculateDistanceKm(lat1, lon1, lat2, lon2)` |
| [`phone.js`](file:///Users/prateek/Roavuto/server/src/utils/phone.js) | Formats and validates 10-digit Indian phone numbers with `+91` prefix. | `formatIndianPhone(phone)`, `isValidPhone(phone)` |
| [`email.js`](file:///Users/prateek/Roavuto/server/src/utils/email.js) | Transactional email helper via Resend SDK. | `sendEmail({ to, subject, html })` |
| [`whatsapp.js`](file:///Users/prateek/Roavuto/server/src/utils/whatsapp.js) | Meta WhatsApp Cloud API template message sender. | `sendWhatsAppTemplate({ phone, templateName, components })` |
| [`jwt.js`](file:///Users/prateek/Roavuto/server/src/utils/jwt.js) | Signs and verifies Access & Refresh JWTs. | `generateToken(payload, secret, expiresIn)`, `verifyToken(token, secret)` |
| [`generateOtp.js`](file:///Users/prateek/Roavuto/server/src/utils/generateOtp.js) | Generates cryptographically secure 6-digit numeric OTP. | `generateOtp() => string` |
| [`hashOtp.js`](file:///Users/prateek/Roavuto/server/src/utils/hashOtp.js) | Hashes OTP with salt before DB persistence. | `hashOtp(otp) => string` |
| [`bookingCode.js`](file:///Users/prateek/Roavuto/server/src/utils/bookingCode.js) | Generates human-readable booking codes. | `generateBookingCode() => "ROV-8F3K9A"` |
| [`garageHours.js`](file:///Users/prateek/Roavuto/server/src/utils/garageHours.js) | Evaluates if garage is open based on business hours JSON. | `isGarageOpenNow(openingHoursJson)` |
| [`garageCapabilities.js`](file:///Users/prateek/Roavuto/server/src/utils/garageCapabilities.js) | Matches garage features against service requirements. | `evaluateGarageCapabilities(garage, requiredServices)` |
| [`platformFee.js`](file:///Users/prateek/Roavuto/server/src/utils/platformFee.js) | Calculates platform commission percentage and net payout. | `calculatePlatformFee(totalAmount, feePercentage)` |
| [`cursorPagination.js`](file:///Users/prateek/Roavuto/server/src/utils/cursorPagination.js) | Encodes and decodes Base64 cursor objects for paginated list queries. | `encodeCursor(data)`, `decodeCursor(cursorString)` |
| [`invalidateCustomerCache.js`](file:///Users/prateek/Roavuto/server/src/utils/invalidateCustomerCache.js) | Clears customer profile & booking Redis keys upon update. | `invalidateCustomerCache(userId)` |
| [`invalidatePublicCache.js`](file:///Users/prateek/Roavuto/server/src/utils/invalidatePublicCache.js) | Clears public city & service catalog Redis keys. | `invalidatePublicCache()` |
| [`logControls.js`](file:///Users/prateek/Roavuto/server/src/utils/logControls.js) | Environment-aware logger wrapper suppressing verbose debug logs in prod. | `logger.info()`, `logger.warn()`, `logger.error()` |

---

## 3. Deep Dive: Redis Caching Pattern ([`utils/cache.js`](file:///Users/prateek/Roavuto/server/src/utils/cache.js))

```javascript
// High-performance caching pattern using Redis and fallback execution
async function getOrSetCache(key, ttlSeconds, fetchFn) {
  if (!redis) return await fetchFn();
  try {
    const cachedData = await redis.get(key);
    if (cachedData) return JSON.parse(cachedData);
  } catch (err) {
    console.warn(`Redis get error for key ${key}:`, err.message);
  }

  const freshData = await fetchFn();
  if (redis && freshData !== undefined) {
    try {
      await redis.set(key, JSON.stringify(freshData), "EX", ttlSeconds);
    } catch (err) {
      console.warn(`Redis set error for key ${key}:`, err.message);
    }
  }
  return freshData;
}
```
