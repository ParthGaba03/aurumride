# AurumRide Frontend

This is the Next.js frontend for AurumRide.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Leaflet / React-Leaflet

## Features

- Map-first booking interface
- Trip summary and booking confirmation flow
- Explain Price view with SHAP contribution display
- My Trips page
- Admin pages for drivers, bookings, and analytics
- Session-aware navigation and account controls

## Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build and Lint

```bash
npm run lint
npm run build
```

