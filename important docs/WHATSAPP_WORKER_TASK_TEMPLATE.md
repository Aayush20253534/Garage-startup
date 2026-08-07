# WhatsApp Worker Task Assignment Template

> Template contract verified against the worker-task implementation on 8 August 2026.

Use this template only for garages where **Controller accounts enabled** is switched off. Permanent controller notifications continue using their existing templates when controller accounts are enabled.

## Template configuration

- Name: `garage_worker_task_assignment`
- Category: Utility
- Language: English (`en`)

## Body

```text
Hello {{1}},
You have been assigned a Rovauto {{2}} task.

Vehicle: {{3}}
Booking: {{4}}
Location: {{5}}

Tap Open Task. No worker login or worker OTP is required.
For Hindi instructions, tap हिंदी and then 🔊 सुनें inside the task page.
For pickup tasks, the customer handover OTP is required only when physically receiving the vehicle. Self-drop tasks use arrival evidence and no OTP.
```

Body values:

1. Worker name
2. Task description
3. Vehicle brand/model
4. Booking code
5. Current destination area/location

Example:

```text
Ramesh
vehicle pickup and handover
Hyundai i20
RV-1042
Civil Lines, Prayagraj
```

## Website button

Add one **Visit website** button:

- Button text: `Open Task`
- URL: `https://www.rovauto.com/worker-task/{{1}}`

The button placeholder is separate from body placeholders. The backend provides only the secure token suffix for the button.

Do not put the raw token in the body text, logs, analytics events, or support notes.

## Environment

```env
WHATSAPP_WORKER_TASK_TEMPLATE=garage_worker_task_assignment
WHATSAPP_WORKER_TASK_TEMPLATE_LANGUAGE=en
WORKER_TASK_TTL_HOURS=12
```

When the stack runs locally in Docker, `localhost` task URLs are reachable only on the same machine and cannot be opened from a worker phone or WhatsApp provider. Use an HTTPS tunnel/staging host and set `PUBLIC_API_URL`/frontend URLs accordingly for end-to-end template tests.

Allowed task TTL is 1-48 hours; the environment value is the default.

## Approval and fallback

Until Meta approves the template or when delivery fails:

- The task is still created.
- The manager/admin receives the generated secure task URL in the API/UI result.
- The link can be copied or shared manually through WhatsApp.
- Resending rotates the raw token and invalidates the previous link.

## Worker page language and voice

The page contains English and Hindi text. Tapping **हिंदी** changes the displayed instructions. Tapping **🔊 सुनें** uses the browser Web Speech API with `hi-IN` speech synthesis.

No paid translation or text-to-speech API is required. Voice availability and quality depend on the phone/browser. The page must show a clear unsupported-browser message if `speechSynthesis` is unavailable.

The WhatsApp template itself is not dynamically translated. A separate Hindi WhatsApp template may be approved later, but the current backend sends the configured single template language.

## Journey behaviour

### Pickup handover

- Open task.
- Start live tracking.
- Reach customer.
- Upload 5-15 images and exactly one video, then wait for the persisted **Uploaded** state before leaving the task.
- Enter customer handover OTP.
- Keep the same link open while returning to the garage.
- Press **Reached garage — complete task**.

### Self drop

- The customer starts the one-time route from their booking page.
- The worker task observes the customer route but does not publish worker location for this phase.
- When the customer is near the garage, upload 5-15 before-service images and one video and confirm arrival without OTP.
- Post-service evidence marks the vehicle ready for customer collection; no second map opens.

### Delivery

- For pickup/delivery bookings, track from garage to customer and upload delivery evidence.
- For self-drop bookings, the task records ready-for-self-pickup evidence at the garage.

## Privacy boundary with RC verification

Vehicle RC verification and admin live RC lookup are separate from the worker-task template. Do not add full RC owner names, provider responses, customer account contact data, Way2API credentials, or verification metadata to WhatsApp worker-task templates. A worker task needs only the minimum booking/task context required for physical handover/delivery.

## Template-change checklist

When changing placeholders or URL:

1. Update `sendGarageWorkerTaskWhatsapp` parameter order.
2. Update this document.
3. Submit/reapprove the Meta template.
4. Test sandbox/manual delivery.
5. Confirm token is not exposed in logs.
6. Confirm fallback copy-link flow remains available.
