# Booking A Vehicle Service

Rovauto helps customers book vehicle services from verified garages in supported Indian cities. The assistant should explain what customers can do in the app, but it must not promise that a particular garage will accept, quote a final repair price, or claim that help has been dispatched before the app confirms it.

## Before Booking

Sign in with a customer account and add at least one vehicle. Select the services you need and review the available price range for your city and vehicle. A vehicle can have only one active booking at a time, so complete or cancel the current booking before creating another booking for the same vehicle.

## Which Location Is Used

At checkout, Rovauto first tries to use the customer's current browser GPS location when location permission is available and the detected city is serviceable. If live location is unavailable, denied, times out, cannot be resolved, or is outside the supported area, the booking uses the customer's saved default location.

Using live GPS for checkout does not silently replace the saved default address. Customers can manage saved locations separately from their profile or location screens.

## Vehicle And Service Selection

Choose a saved vehicle, then select one or more active services. Some services may be unavailable or marked coming soon in a particular city. Prices shown before booking are estimated ranges based on the configured city, service, and vehicle details. The garage confirms the final service amount after inspecting and completing the work.

## Checkout And Platform Fee

The amount paid online at checkout is the Rovauto platform fee, not the final garage service bill. Customers may apply available Rovauto wallet balance first. If wallet balance does not cover the full platform fee, the remaining amount is paid through Cashfree. If the wallet covers the full amount, no external payment page is needed.

The final service amount is paid directly to the garage after the work is completed and the customer reviews the delivery details.

## Progressive Garage Search

After the platform fee is confirmed, the booking enters garage search:

1. Rovauto searches for eligible verified garages within 5 km.
2. If nobody accepts, the search expands to 10 km.
3. If nobody accepts, the search expands to 20 km.
4. If the 20 km round also ends without acceptance, Rovauto shows a clear retry message and automatically starts a new cycle from 5 km.

Each radius round normally lasts about two minutes. Garages already contacted in the same 5 km, 10 km, and 20 km cycle are not repeatedly notified in every round. A restarted cycle does not require another platform-fee payment or any action from the customer.

Garage eligibility depends on current availability, supported services, vehicle support, verification status, and service radius. The assistant must not guarantee that a garage will be found or accepted within a specific time.

## After A Garage Accepts

The customer receives the assigned garage details and a handover OTP. Keep the OTP private and share it only with the assigned garage when physically handing over the vehicle. The OTP can be regenerated from the booking tracker before service starts when the app allows it.

The garage verifies the handover OTP and records pickup inspection photos before work begins. The booking then moves into service progress.

## Tracking And Completion

Customers can open the active booking tracker to see search radius, assigned garage information, booking progress, inspection images, notifications, and available live tracking. Live road distance and ETA may be shown when route information is available, but they are estimates and can change with traffic or provider availability.

After the garage marks the vehicle delivered, the customer reviews the delivery information, enters or confirms the final service amount, and accepts delivery. The booking then appears in service history and its Rovauto warranty becomes available.

## Cancelling A Booking

A customer can cancel while the booking is pending payment, searching for a garage, assigned, or confirmed, as long as service has not started. When an eligible paid booking is cancelled, the paid platform-fee amount is credited to the customer's Rovauto wallet. Once the booking is in progress or completed, normal cancellation is not available; use support or a dispute ticket when help is needed.
