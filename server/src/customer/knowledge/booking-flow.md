# Booking A Vehicle Service

> Customer-assistant knowledge verified on 25 July 2026.

Rovauto helps customers book vehicle services from verified garages in supported Indian cities. The assistant should explain what customers can do in the app, but it must not promise that a particular garage will accept, quote a final repair price, or claim that help has been dispatched before the app confirms it.

## Before Booking

Sign in with a customer account and add at least one vehicle. Select the services you need and review the available price range for your city and vehicle. A vehicle can have only one active booking at a time, so complete or cancel the current booking before creating another booking for the same vehicle.

Most services support both vehicle-handover options. At checkout, choose one option for the booking:

- **Pickup & delivery:** the assigned garage follows Rovauto's normal vehicle pickup and return process.
- **Self drop-off & pickup:** the customer takes the vehicle to the assigned garage and collects it from the garage after service.

A service marked **Self drop-off only** disables pickup and automatically requires self drop-off for the booking. Rovauto sends the request only to garages that support the selected handover mode, serve the selected vehicle brand and model, and are assigned every selected service.

## Which Location Is Used

At checkout, Rovauto uses the customer's selected saved service location. It does not request the customer's current browser GPS or silently replace the service destination with the device's current position.

For a pickup-and-delivery booking, the confirmed address is the destination used by the assigned garage. If the vehicle needs service at a different address, the customer can explicitly edit, confirm, and save the service address at checkout before paying. The confirmed address and coordinates are stored on the booking so the assigned garage navigates to that destination even when the customer or their device is somewhere else.

For a self drop-off booking, the saved location is still used to confirm the supported city and find suitable nearby garages, but the garage does not collect or return the vehicle. After a garage accepts, the customer uses the garage address and directions shown in the booking tracker.

During a normal pickup-and-delivery job, live location sharing belongs to the assigned garage and helps show its route or arrival progress. Garage live tracking does not change the customer's stored booking destination. Live pickup tracking is not used for self drop-off bookings.

## Vehicle And Service Selection

Choose a saved vehicle, then select one or more active services. At checkout, choose pickup or self drop-off unless one of the selected services is self drop-off only. Some services may be unavailable or marked coming soon in a particular city. Prices shown before booking are estimated ranges based on the configured city, service, and vehicle details. The garage confirms the final service amount after inspecting and completing the work.

## Checkout And Platform Fee

The amount paid online at checkout is the Rovauto platform fee, not the final garage service bill. Customers may apply available Rovauto wallet balance first. If wallet balance does not cover the full platform fee, the remaining amount is paid through Cashfree. If the wallet covers the full amount, no external payment page is needed.

The final service amount is paid directly to the garage after the work is completed and the customer reviews the delivery or collection details.

## Progressive Garage Search

After the platform fee is confirmed, the booking enters garage search. This matching process applies to both pickup-and-delivery and self drop-off bookings:

1. Rovauto searches for eligible verified garages within 5 km.
2. If nobody accepts, the search expands to 10 km.
3. If nobody accepts, the search expands to 20 km.
4. If the 20 km round also ends without acceptance, Rovauto shows a clear retry message and automatically starts a new cycle from 5 km.

Each radius round normally lasts 2 minutes 30 seconds. Garages already contacted in the same 5 km, 10 km, and 20 km cycle are not repeatedly notified in every round. Their original request remains available while the booking is still unassigned. A restarted cycle does not require another platform-fee payment or any action from the customer.

Garage eligibility depends on operational and verification state, supported services, vehicle capabilities and exclusions, coordinates, and service radius. The assistant must not guarantee that a garage will be found or accepted within a specific time.

## After A Garage Accepts

The customer receives the assigned garage details and a handover OTP. Keep the OTP private and share it only during physical vehicle handover. The OTP can be regenerated from the booking tracker before service starts when the app allows it.

For **pickup & delivery**, the customer follows the normal live garage route and handover process. Share the OTP only when the assigned garage owner or assigned controller physically receives the vehicle. The garage records the required pickup inspection photos before work begins.

For **self drop-off & pickup**, the tracker shows the garage address, directions, contact details, and a reminder that no pickup vehicle will arrive. Take the vehicle to the assigned garage, then share the OTP with garage staff after reaching the garage. The garage records the required drop-off inspection photos before work begins.

## Tracking And Completion

Customers can open the active booking tracker to see search radius, assigned garage information, booking progress, inspection images, notifications, and the actions available for that booking type.

For pickup-and-delivery bookings, live road distance and ETA may be shown when route information is available, but they are estimates and can change with traffic or provider availability. After the garage marks the vehicle delivered, the customer reviews the delivery information, enters or confirms the final service amount, and accepts delivery.

For self drop-off bookings, the tracker does not show a garage pickup route. After service, the garage marks the vehicle **Ready for customer pickup** and uploads post-service inspection photos. The customer returns to the garage, inspects the vehicle, enters the final amount paid, and selects **Confirm Vehicle Collection**.

After delivery acceptance or collection confirmation, the booking appears in service history and its Rovauto warranty becomes available.

## Cancelling A Booking

A customer can cancel while the booking is pending payment, searching for a garage, assigned, or confirmed, as long as service has not started. When an eligible paid booking is cancelled, the paid platform-fee amount is credited to the customer's Rovauto wallet. Once the booking is in progress or completed, normal cancellation is not available; use support or a dispute ticket when help is needed.
