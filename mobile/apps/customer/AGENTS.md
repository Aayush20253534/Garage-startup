# Expo customer app rules

- This application uses Expo SDK 57, Expo Router, React Native 0.86, and React 19.
- Read the exact Expo SDK 57 documentation before adding or upgrading native modules.
- Routes live in `src/app`, not the repository-level `app` folder.
- Use `src/lib/api/client.ts` for HTTP requests and `expo-secure-store` for sensitive tokens.
- Treat every `EXPO_PUBLIC_*` variable as public application configuration.
- Do not assume browser cookie/CSRF behaviour applies to the native app; the current mobile client is designed around bearer-token storage and the server contract must support it before production release.
- Many screens are placeholders. Do not document a screen as production-complete until its API, loading, error, and authentication states are implemented and tested.
- Run `npm run lint` and TypeScript validation after changes, and test on a physical Android device before release.
