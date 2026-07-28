# WhatsApp worker task assignment template

Create this template in **WhatsApp Manager → Message templates** before enabling automatic worker assignment messages.

## Template configuration

- **Name:** `garage_worker_task_assignment`
- **Category:** Utility
- **Language:** English (`en`)

## Body

```text
Hello {{1}},
You have been assigned a Rovauto {{2}} task.

Vehicle: {{3}}
Booking: {{4}}
Location: {{5}}

Tap Open Task. No worker login or worker OTP is required.
For Hindi instructions, tap हिंदी and then 🔊 सुनें inside the task page.
The customer handover OTP is required only when physically receiving the vehicle.
```

## Button

Add one **Visit website** button:

- **Button text:** `Open Task`
- **URL:** `https://www.rovauto.com/worker-task/{{1}}`

The body placeholders and URL-button placeholder are separate placeholder sequences in WhatsApp Manager. The backend sends the secure task token only as the dynamic URL-button value.

## Example body values

1. `Ramesh`
2. `vehicle pickup and handover`
3. `Hyundai i20`
4. `RV-1042`
5. `Civil Lines, Prayagraj`

## Production environment

```env
WHATSAPP_WORKER_TASK_TEMPLATE=garage_worker_task_assignment
WHATSAPP_WORKER_TASK_TEMPLATE_LANGUAGE=en
WORKER_TASK_TTL_HOURS=12
```

After Meta approves the template, deploy these values and create a task from the assigned booking. Until approval, Rovauto still creates the secure task URL and shows it to the manager/admin for manual sharing.

## Worker journey behaviour

For pickup bookings, the same link remains active after the customer handover OTP is verified. The destination changes to the garage, live tracking can continue during the return journey, and the worker presses **Reached garage — complete task** after arriving.

For self-drop bookings, pickup tracking is not shown. The worker link is used only for handover or ready-for-self-pickup photo/video evidence at the garage.
