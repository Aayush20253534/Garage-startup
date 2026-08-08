# 14. Garage Module Documentation

## 1. Executive Summary & Module Role

The **Garage Module** ([`server/src/garage/`](file:///Users/prateek/Roavuto/server/src/garage)) manages all garage partner operations. It powers partner onboarding applications, owner/controller authentication, broadcast request dispatches, active booking execution, worker task tokenization, garage media management, and revenue wallet management.

---

## 2. Onboarding & Application Processing Pipeline

```mermaid
flowchart TD
    AppSubmission["Garage Partner Submits Form (POST /garage/applications)"] --> UploadCloud["Upload Photos to Cloudinary"]
    UploadCloud --> SaveApp["Create GarageApplication Record (Status: PENDING)"]
    SaveApp --> OutboxEmail["Queue Email in GarageApplicationEmailOutbox"]
    OutboxEmail --> EmailWorker["Outbox Background Worker"]
    EmailWorker --> SendResend["Send Confirmation Email via Resend API"]

    SaveApp --> AdminReview{"Admin / Staff Review"}
    AdminReview -- Approve --> ApproveSvc["garageApplication.service.approveApplication()"]
    AdminReview -- Request Changes --> ChangeReq["Update Status: CHANGES_REQUESTED"]
    AdminReview -- Deny --> DenyApp["Update Status: DENIED"]

    ApproveSvc --> CreateOwner["Create GarageOwner Account"]
    ApproveSvc --> CreateGarage["Create Garage Entity (ACTIVE)"]
    ApproveSvc --> CreateGWallet["Create GarageWallet"]
    ApproveSvc --> SendCreds["Queue Credentials Email via Outbox"]
```

---

## 3. Dual Auth Model: Owner vs. Controller

Garages support two distinct operational personas:
1. **`GarageOwner`**: Business owner. Manages payout account details, views analytics, manages controller credentials, and configures garage working hours. Authenticates via email/password or OTP.
2. **`GarageController`**: On-site terminal operator or shop manager. Operates on tablet/desktop terminals to view incoming broadcasts, accept jobs, assign workers, and record inspection photos. Authenticates via numeric `loginId` and PIN/password.

---

## 4. Worker Task Tokenization & Logistics Flow

```mermaid
sequenceDiagram
    autonumber
    actor Controller as Garage Controller
    participant Svc as Worker Task Service
    participant DB as PostgreSQL DB
    actor Worker as Driver / Worker
    participant PublicApp as Public Worker Portal (/task/:token)

    Controller->>Svc: createWorkerTask(bookingId, taskType: "PICKUP", workerPhone)
    Svc->>Svc: Generate 32-byte crypto token & calculate SHA-256 tokenHash
    Svc->>DB: Save GarageWorkerTask (status: ACTIVE, expiresAt: NOW + 12h)
    Svc-->>Controller: Return link: https://rovauto.com/task/<rawToken>
    Controller->>Worker: Send SMS / WhatsApp with task link
    Worker->>PublicApp: Open /task/<rawToken> in mobile browser
    PublicApp->>DB: Query task by SHA-256(rawToken)
    DB-->>PublicApp: Task details & Customer address
    Worker->>PublicApp: Click "Start Journey"
    PublicApp->>DB: Update task status = STARTED, record GPS points
```

---

## 5. Garage Wallet & Earnings Settlement

- **Models**: `GarageWallet`, `GarageWalletTransaction`.
- **Earnings Allocation**:
  - Upon booking completion (`status = COMPLETED`), `bookingLifecycleService` calculates platform fee deduction (e.g. 10%) and credits net earnings to the garage's `GarageWallet`.
  - Generates immutable `GarageWalletTransaction` record with transaction type `EARNING`.
