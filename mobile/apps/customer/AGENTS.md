# Expo customer app rules

> Rules synchronized with the repository on 30 July 2026.

- This application uses Expo SDK 57, Expo Router, React Native 0.86, and React 19.
- Read the exact Expo SDK 57 documentation before adding or upgrading native modules.
- Routes live in `src/app`, not the repository-level `app` folder.
- Use `src/lib/api/client.ts` for HTTP requests and `expo-secure-store` for sensitive tokens.
- Treat every `EXPO_PUBLIC_*` variable as public application configuration.
- Do not assume browser cookie/CSRF behaviour applies to the native app; the current mobile client is designed around bearer-token storage and the server contract must support it before production release.
- Many screens are placeholders. Do not document a screen as production-complete until its API, loading, error, and authentication states are implemented and tested.
- Run `npm run lint` and TypeScript validation after changes, and test on a physical Android device before release.

- Match the web/backend payment-hours contract: 10:00 AM inclusive to 12:00 AM midnight exclusive in Asia/Kolkata, while treating the server response as authoritative.
- Do not claim inspection media is uploaded until the API confirms persistence; mobile video work must target an MP4/H.264-compatible upload path and support retryable processing states.
- The Docker stack does not containerize Expo. Android emulators should use the host bridge (commonly `10.0.2.2`) and physical devices must use the development machine's reachable LAN/tunnel URL.
