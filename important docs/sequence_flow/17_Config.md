# 17. Configuration & Environment Reference

## 1. Executive Summary

Configuration management in the Rovauto backend is centralized under [`server/src/config/`](file:///Users/prateek/Roavuto/server/src/config). Environment validation is executed at process boot in [`config/env.js`](file:///Users/prateek/Roavuto/server/src/config/env.js) using Zod schemas to ensure missing or malformed environment variables immediately abort server startup.

---

## 2. Master Environment Variables Reference

| Variable Name | Required | Default / Example | Purpose & Operational Impact |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `development` / `production` | Controls CORS policies, verbose logging, and security cookies. |
| `PORT` | No | `5000` | Port for Express HTTP server to listen on. |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/rovauto` | PostgreSQL connection string for Prisma. |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL for caching & rate limiting. |
| `JWT_SECRET` | Yes | 64-char hex string | Secret key for signing Access JWT tokens. |
| `JWT_REFRESH_SECRET` | Yes | 64-char hex string | Secret key for signing Refresh JWT tokens. |
| `COOKIE_SECRET` | Yes | 64-char hex string | Secret key for signing express cookies. |
| `CASHFREE_APP_ID` | Yes | `TEST...` / `PROD...` | Cashfree Payment Gateway App ID. |
| `CASHFREE_SECRET_KEY` | Yes | 64-char string | Cashfree API Secret for order creation & webhook HMAC. |
| `CLOUDINARY_CLOUD_NAME`| Yes | `rovauto-media` | Cloudinary account name for media uploads. |
| `CLOUDINARY_API_KEY` | Yes | 15-digit string | Cloudinary API Key. |
| `CLOUDINARY_API_SECRET`| Yes | 27-char string | Cloudinary API Secret. |
| `RESEND_API_KEY` | Yes | `re_123456789` | Resend API Key for email dispatches. |
| `GROQ_API_KEY` | No | `gsk_...` | Groq LLM API Key for AI chatbot. |
| `VAPID_PUBLIC_KEY` | Yes | Base64 string | Public VAPID key for Web Push notifications. |
| `VAPID_PRIVATE_KEY` | Yes | Base64 string | Private VAPID key for signing Push messages. |
| `WHATSAPP_TOKEN` | No | Bearer token | Meta WhatsApp Cloud API access token. |
| `ALLOWED_ORIGINS` | No | `https://rovauto.com` | Comma-separated CORS allowed origins. |

---

## 3. Server Startup Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Node as Node.js Process
    participant Env as config/env.js
    participant Prisma as config/prisma.js
    participant Redis as config/redis.js
    participant Workers as Background Services
    participant HTTP as Express app.listen()

    Node->>Env: validateEnvironment()
    alt Env Validation Fails
        Env-->>Node: Throw Error & Exit Process (Code 1)
    else Env Valid
        Env-->>Node: Environment Loaded
    end

    Node->>Prisma: prisma.$connect()
    Prisma-->>Node: PostgreSQL Connected

    Node->>Workers: startGarageSearchWorker()
    Node->>Workers: startSystemIssueAutoResolver()
    Node->>Workers: startGarageApplicationEmailOutboxWorker()
    Node->>Workers: startSessionRetentionCleanup()

    Node->>HTTP: app.listen(PORT)
    HTTP-->>Node: Server Running on Port 5000
```

---

## 4. Graceful Shutdown Protocol

Implemented in [`server.js:91-133`](file:///Users/prateek/Roavuto/server/src/server.js#L91-L133):
1. **Signal Interception**: Catches `SIGTERM`, `SIGINT`, `uncaughtException`, and `unhandledRejection`.
2. **Worker Termination**: Immediately stops background interval timers (`stopGarageSearchWorker()`, `stopSystemIssueAutoResolver()`, `stopGarageApplicationEmailOutboxWorker()`, `stopSessionRetentionCleanup()`).
3. **HTTP Server Closing**: Calls `server.close()` and `server.closeIdleConnections()` to stop accepting new requests while completing active ones.
4. **Pool Draining**: Closes Prisma connection (`prisma.$disconnect()`) and drains Redis connections (`redis.quit()`).
5. **Fallback Timeout**: Sets a force-exit timer (`SHUTDOWN_TIMEOUT_MS = 15,000 ms`) to force `process.exit(1)` if tasks fail to close gracefully.
