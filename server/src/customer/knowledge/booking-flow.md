# Rovauto Customer Booking Flow

Rovauto is an India-focused vehicle service platform that helps customers book trusted garage services from the user side of the website.

## Before Booking

Customers should log in or register as a customer, not as a garage owner. Customer and garage owner accounts are separate even when the same email address is used. A customer needs a saved location and a vehicle before completing a booking.

## Location

The app requires a serviceable Indian city. Cities are managed by the admin panel. If a customer selects or detects a city where Rovauto is not available, the app shows: "Rovauto isn't available in your area yet."

When a customer uses current location, browser GPS coordinates are saved directly. The address boxes are filled from reverse location details where possible. Save and continue should not geocode again because coordinates already came from GPS.

When a customer types an address manually, the app geocodes the typed Indian address on save and stores latitude and longitude in the database.

## Vehicle Selection

Customers can add a vehicle by choosing brand, model, year, fuel type, and optional registration number. One vehicle can be set as default. Vehicle selection is compulsory for booking services.

## Service Selection

Customers choose services from the Services page or service category pages. Services can include normal vehicle maintenance and roadside assistance. Prices shown are estimates or ranges when configured by city, service, vehicle brand, model, or fuel type.

## Garage Selection

After service and location selection, the app finds nearby active garages that serve the selected service. Garage selection depends on saved customer coordinates and garage coordinates.

## Checkout And Payment

Customers review vehicle, services, location, price range, handling fee, and payable amount before payment. Cashfree is used for payment. Bookings may begin as pending payment and then move to searching garage or assigned status after payment and garage acceptance.

## Tracking

Customers can track active bookings from dashboard, active bookings, and booking tracking screens. A booking can show garage details, service details, payment details, OTP handover, progress, and delivery status.
