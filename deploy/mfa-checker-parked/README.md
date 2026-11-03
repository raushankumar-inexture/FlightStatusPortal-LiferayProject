# Parked: Twilio SMS MFA checker

This code is NOT built. It was moved out of `modules/flight-status-api` because that module
imported Liferay's multi-factor packages, and when those bundles were not active the whole
API module (live map, flights, boarding pass) failed to start.

To use it again, make it its own workspace module (for example `modules/flight-status-mfa`)
with this dependency in its own `build.gradle`:

    compileOnly group: "com.liferay", name: "com.liferay.multi.factor.authentication.spi", version: "default"

It also needs the TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER settings.
