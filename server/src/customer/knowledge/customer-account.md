# Rovauto Customer Account Help

## Login And Registration

Customers can register with name, email, mobile number, and password, or continue with Google. Login supports email or phone with password. OTP flows are used for phone verification and password recovery.

## Customer Versus Garage Owner

Customer accounts and garage owner accounts are separate user identities. If the same email is used for both, the customer account and garage owner account still have different user IDs and different roles. Garage application details should not be stored inside the customer section.

## Required Setup After Login

After login, a customer should complete location and vehicle setup. Location is compulsory like vehicle selection because bookings and nearby garages depend on it.

## Profile Settings

Customers can update name, phone, address, and avatar from profile settings. When address is changed manually, the app should geocode the Indian address and update the stored latitude and longitude. When current location is used, the app should store GPS coordinates directly without geocoding.

## Saved Coordinates

Coordinates are stored in customer location records. Valid India coordinates must be present for nearby garage search and booking. Invalid or zero coordinates such as 0,0 are not usable.

## Wallet And Payments

Customers can view wallet balance, payment history, and booking payments. Wallet usage and online payment information appear with booking records where applicable.

## Notifications

Customers receive notifications for important updates such as booking status changes, admin messages, and service events.
