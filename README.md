# RentLedger — Next.js Frontend Starter

A responsive frontend starter for the rental business management app. It is designed to talk to the matching Django REST API in `rental_backend_starter`.

## Included screens

- Sign in
- Division-specific dashboard
- Inventory catalogue and category creation
- Opening stock entry during catalogue-item creation
- Customer directory
- Booking register with search/status filters
- Booking creation with catalogue items, quantities, standard prices, and dates
- Optional discount
- Optional delivery details and delivery fee
- Optional refundable security-deposit requirement
- Catering jobs page for divisions where `has_catering_services` is enabled
- Catering job creation with service lines, optional reusable-material allocations, optional discount, and optional delivery

## Stack

- Next.js App Router
- React + TypeScript
- Lucide icons
- Custom responsive CSS (no Tailwind requirement)
- Django API accessed through same-origin Next.js route handlers

## Before running

1. Make sure the Django backend has its dependencies installed, migrations generated and applied, and the initial `dad-tables` and `mom-catering` divisions seeded.
2. In this folder, install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and configure:

   ```env
   DJANGO_API_BASE_URL=http://127.0.0.1:8000/api
   ```

   The value should point to the Django API root and include `/api`, but no trailing slash is required. In Vercel, use the public Render service URL, for example `https://your-service.onrender.com/api`.

4. Start Django in a separate terminal, then run the frontend:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000` and sign in using a Django user's email address and password.

## Authentication and proxy design

The browser does not call Django directly. It calls same-origin Next.js route handlers, which forward requests to Django. The Django access and refresh JWTs are stored in `HttpOnly`, `SameSite=Lax` cookies rather than localStorage. The proxy refreshes an expired access token using the refresh token and retries the request once.

This reduces direct JavaScript access to JWTs. It is not a substitute for full production security review: retain origin checks, HTTPS, secure environment variables, short access-token lifetimes, appropriate refresh-token lifetime, and backend authorization tests. Do not expose `DATABASE_URL`, Supabase credentials, Django `SECRET_KEY`, or JWTs through `NEXT_PUBLIC_*` variables.

## Endpoint assumptions

The frontend uses the API routes currently documented in the matching backend starter:

- `POST /auth/token/` via the login route handler
- `GET /auth/me/`
- `GET/POST /customers/`
- `GET/POST /categories/`
- `GET/POST /items/`
- `GET /inventory/balances/`
- `POST /inventory/stock-additions/`
- `GET/POST /bookings/`
- `POST /bookings/{id}/security-deposit/`
- `POST /bookings/{id}/confirm/`
- `GET/POST /catering/jobs/` and `POST /catering/jobs/{id}/confirm/`
- `GET /dashboard/`

The UI expects list endpoints to return JSON arrays, consistent with the starter backend. If pagination is introduced, update the client API response handling.

## Known boundaries

- The backend starter has not yet been validated with Django runtime checks and live PostgreSQL migrations in this environment. Validate the backend before relying on this frontend for real data.
- The booking register is read-only except for booking creation in this iteration. Booking detail, payment entry, dispatch, returns, invoice PDF rendering, receipt PDF rendering, and WhatsApp document sharing remain to be built.
- The catering job register and create flow are included, but later steps such as catering material dispatch/returns, job payment forms, printable invoices, and customer document sharing remain outstanding.
- The UI displays physically usable stock on hand; the final date-specific availability remains enforced by the backend when a booking is confirmed.
- This is a development starter, not a production-certified application.

## Useful commands

```bash
npm run dev
npm run build
npm run lint
```

If TypeScript reports API-shape mismatches, compare them to `API_REFERENCE.md` in the backend starter before weakening a type.


See [VALIDATION_REPORT.md](VALIDATION_REPORT.md) for checks that ran and checks that remain pending. The starter has not yet passed a full Next.js production build because npm dependencies could not be installed in the authoring environment.
