<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to Lovable. Do not rewrite published Git history
> with force-pushes, rebases, amended commits, or squashes after the commits have
> been pushed. Keep the connected branch in a buildable state.
<!-- LOVABLE:END -->

# Client change rules

- The web application is React 18 + Vite 5 and uses `src/App.jsx` as the shared route tree.
- Preserve the five document shells: `index.html`, `garage.html`, `admin.html`, `intern.html`, and `support.html`.
- Use `src/api/axios.js` for authenticated browser requests so cookies, CSRF, request IDs, timeout handling, and safe retries remain consistent.
- Never store browser JWTs in local storage and never place secrets in `VITE_*` variables.
- Keep public `/warranty` separate from protected `/dashboard/warranty`.
- Keep `/worker-task/:token` public but token-scoped; do not wrap it in normal garage/customer authentication.
- When changing garage navigation, preserve controller hiding while `controllerAccountsEnabled` is false.
- Use rectangular operational controls in admin pages and retain responsive, loading, empty, retry, and permission-denied states.
- Validate changed JSX with the production build or TypeScript `transpileModule`, then run relevant source-regression tests under `server/test/security`.
