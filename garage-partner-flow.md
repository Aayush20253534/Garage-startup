# Garage Partner And Booking Flow

## 1. Garage Partner Application Flow

```mermaid
flowchart TD
    A["Garage owner visits Rovauto"] --> B["Clicks Apply / Become a Partner"]
    B --> C["Fills garage inquiry form"]
    C --> D["Submits application"]
    D --> E["Application saved in DB as Pending Garage Application"]

    E --> F["Admin reviews application"]
    F --> G{"Admin decision"}

    G -->|Denied| H["Application marked Denied"]
    H --> I["Rejection email sent to garage owner"]

    G -->|Changes requested| J["Application marked Changes Requested"]
    J --> K["Email sent with required corrections"]
    K --> L["Garage owner updates/resubmits form"]
    L --> E

    G -->|Accepted| M["Application marked Approved"]
    M --> N["Garage owner account created/verified"]
    N --> O["Garage profile created in Garage List"]
    O --> P["Approval email sent with login/access instructions"]
    P --> Q["Garage owner logs in"]
```

## 2. Garage Setup And Listing Flow

```mermaid
flowchart TD
    A["Garage owner logs in"] --> B["Garage setup dashboard"]
    B --> C["Add garage details"]
    C --> D["Add owner details"]
    D --> E["Add phone number"]
    E --> F["Add working radius / location"]
    F --> G["Add garage type"]
    G --> H["Add services offered"]
    H --> I["Add service prices"]
    I --> J["Upload mandatory garage photos"]
    J --> K["Submit for final verification"]

    K --> L["Admin verifies details/photos"]
    L --> M{"Approved?"}

    M -->|Needs changes| N["Admin requests changes by email/dashboard note"]
    N --> C

    M -->|Approved| O["Garage marked Verified and Active"]
    O --> P["Garage appears in Garage List"]
    P --> Q["Garage can receive booking leads"]
```

## 3. Customer Booking To Garage Lead Flow

```mermaid
flowchart TD
    A["Customer selects vehicle"] --> B["Customer selects services"]
    B --> C["Customer enters address or uses current location"]
    C --> D["Customer checkout"]
    D --> E["Customer pays booking/platform fee"]
    E --> F["Booking status becomes Searching Garage"]
    F --> G["System finds eligible active garages"]
    G --> H["Booking broadcast sent to matching garages"]
    H --> I["Garage sees new lead in dashboard / WhatsApp"]
```

## 4. Garage Lead Accept / Reject Flow

```mermaid
flowchart TD
    A["Garage receives lead"] --> B{"Garage decision"}

    B -->|Reject| C["Lead marked Rejected"]
    C --> D["Booking remains available for other garages"]

    B -->|Accept| E["Garage accepts lead"]
    E --> F["Wallet / lead fee deducted if applicable"]
    F --> G["Other garage requests expire"]
    G --> H["Booking assigned to accepted garage"]
    H --> I["Customer details unlocked for garage"]
    I --> J["Booking moves to Accepted / Confirmed"]
```

## 5. Garage Job Status Flow

```mermaid
flowchart TD
    A["New booking"] --> B["Accepted"]
    B --> C["Arrived / Mechanic shown"]
    C --> D["Vehicle received"]
    D --> E["Inspection"]
    E --> F["Service in progress"]
    F --> G["Ready to deliver"]
    G --> H["Completed"]
```

## 6. Customer Service Proof / Notes Flow

```mermaid
flowchart TD
    A["Booking accepted by garage"] --> B["Customer can view booking details"]
    B --> C["Customer uploads before-service photos if needed"]
    C --> D["Customer adds service notes / issue description"]
    D --> E["Garage reviews customer photos and notes"]
    E --> F["Service starts"]
    F --> G["Customer can upload after-service photos / feedback if needed"]
    G --> H["Customer confirms completion or raises concern"]
    H --> I["Review / rating flow"]
```

## 7. Booking Details Screen Flow

```mermaid
flowchart TD
    A["Garage opens booking details"] --> B["Show customer details"]
    B --> C["Show selected service details"]
    C --> D["Show OTP / verification step"]
    D --> E["Show estimated bill"]
    E --> F["Navigation button"]
    F --> G["Customer call button"]
    G --> H["WhatsApp button"]
```

## 8. WhatsApp Lead Link Flow

```mermaid
flowchart TD
    A["Garage receives WhatsApp lead link"] --> B["Opens link"]
    B --> C["Views limited booking summary"]
    C --> D{"Accept or decline?"}

    D -->|Decline| E["Lead marked Declined"]
    D -->|Accept| F["Garage account/wallet check"]
    F --> G["Lead accepted"]
    G --> H["Customer details unlocked"]
```

## 9. Database Sections Needed

```mermaid
flowchart LR
    A["Garage Applications"] --> B["Pending"]
    A --> C["Changes Requested"]
    A --> D["Denied"]
    A --> E["Approved"]

    E --> F["Garage List"]
    F --> G["Verified / Active Garages"]
    F --> H["Inactive / Suspended Garages"]
```

## Number-Wise Summary

1. Garage owner submits Apply to Become Partner inquiry form.
2. Form is saved in DB as Pending Garage Application.
3. Admin reviews pending applications.
4. Admin can approve, deny, or request changes.
5. Denied applications trigger rejection email.
6. Changes requested trigger correction email and allow resubmission.
7. Approved application creates/verifies garage owner account.
8. Approved garage profile moves into Garage List.
9. Garage owner logs in and completes setup.
10. Garage adds details, owner info, phone number, working radius, garage type, services, and prices.
11. Garage uploads mandatory garage photos.
12. Admin verifies setup details/photos.
13. Verified garage becomes active/listed.
14. Customer books service and pays booking/platform fee.
15. System broadcasts booking to eligible active garages.
16. Garage accepts or rejects lead.
17. If accepted, booking is assigned and customer details unlock.
18. Job moves through New, Accepted, Arrived, Vehicle Received, Inspection, Service in Progress, Ready to Deliver, Completed.
19. Customer handles before/after photos and service notes where needed.
20. Customer confirms completion and gives review/rating.
