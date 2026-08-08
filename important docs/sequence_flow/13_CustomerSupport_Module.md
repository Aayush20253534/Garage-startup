# 13. Customer Support Module Documentation

## 1. Executive Summary & Module Role

The **Customer Support Module** ([`server/src/customerSupport/`](file:///Users/prateek/Roavuto/server/src/customerSupport)) provides tools for customer support agents (`CustomerSupportAccount`) to manage support tickets, investigate complaints, resolve disputes, process customer refunds, and send targeted push/email notifications.

---

## 2. Support Ticket Lifecycle & Workflow

```mermaid
stateDiagram-v2
    [*] --> OPEN: Customer Submits Ticket
    OPEN --> CLAIMED: Support Agent Claims Ticket
    CLAIMED --> IN_INVESTIGATION: Agent Requests Customer Info
    IN_INVESTIGATION --> RESOLVED_REFUNDED: Agent Grants Refund
    IN_INVESTIGATION --> RESOLVED_REJECTED: Dispute Rejected
    IN_INVESTIGATION --> RESOLVED_CLOSED: Issue Resolved
    RESOLVED_REFUNDED --> [*]
    RESOLVED_REJECTED --> [*]
    RESOLVED_CLOSED --> [*]
```

---

## 3. Data Models & Entity Relationships

```mermaid
erDiagram
    CustomerSupportAccount ||--o{ SupportTicket : "claims / assigned"
    CustomerSupportAccount ||--o{ CustomerSupportSession : "establishes"
    CustomerSupportAccount ||--o{ Notify : "receives"
    CustomerSupportAccount ||--o{ CustomerSupportPushSubscription : "subscribes"

    User ||--o{ SupportTicket : "opens"
    Booking ||--o{ SupportTicket : "references"

    SupportTicket ||--o{ SupportTicketMessage : "contains"
    SupportTicket ||--o{ SupportTicketAttachment : "attaches"
    SupportTicketMessage ||--o{ SupportTicketAttachment : "includes"
```

---

## 4. Primary Controller & Service Reference

- **Controller**: [`customerSupport/controllers/customerSupport.controller.js`](file:///Users/prateek/Roavuto/server/src/customerSupport/controllers/customerSupport.controller.js)
- **Service**: [`customerSupport/services/customerSupport.service.js`](file:///Users/prateek/Roavuto/server/src/customerSupport/services/customerSupport.service.js)

### Key Capabilities:
1. `claimTicket(ticketId, supportAccountId)`: Atomically assigns `supportAssigneeId` and sets `claimedAt = NOW()`.
2. `addTicketMessage(ticketId, messagePayload)`: Supports public messages (visible to customer) and internal notes (`isInternal = true`, hidden from customer).
3. `resolveTicketWithRefund(ticketId, refundAmount, note)`: Atomically issues a refund to the customer's `Wallet` via `walletService`, updates ticket status to `RESOLVED`, and records resolution outcome.
4. `sendAgentPushNotification(supportAccountId, payload)`: Sends VAPID web push notifications to the agent's active browser endpoints.
