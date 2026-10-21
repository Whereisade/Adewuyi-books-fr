# Frontend validation report

**Date:** 2026-10-21

## Passed

- Parsed 18 TypeScript/TSX source files with the TypeScript compiler's parser; no syntax diagnostics were reported.
- Inspected frontend endpoint paths against the corresponding route declarations in the companion Django backend starter.
- Confirmed the ZIP package is generated without `node_modules`, `.next`, `.env.local`, or secret credentials.

## Not run

- `npm install`: the attempt using offline npm mode failed because the required package metadata was not cached. No online dependency installation was attempted to avoid claiming a working build without access to the registry.
- `npm run build`: not run because dependencies are unavailable.
- `npm run lint`: not run because dependencies are unavailable.
- End-to-end browser tests against Django: not run. The companion backend still requires Django runtime checks, migration generation and test execution in an environment where dependencies can be installed.

The static validation script is a syntax-only check. It does not validate React component typing, package compatibility, Next.js route build behaviour, API runtime behaviour, authorization, or database correctness.

## Before using live data

1. Install dependencies in a network-enabled development environment with `npm install`.
2. Run `npm run build` and `npm run lint`; fix all reported errors.
3. Configure `DJANGO_API_BASE_URL` locally and test sign-in, session refresh, division isolation, catalogue creation, and booking create/confirm flows against the Django backend.
4. Run the backend's migrations and tests before attaching production business data.
5. Confirm that Vercel uses the correct Render API URL and that all secrets remain server-side.
