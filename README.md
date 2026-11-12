# SOON

A Hebrew-first wedding platform: couples find, compare and book vendors, and vendors and producers run their business.

## Repo layout

```
apps/
  mobile/    Expo (iOS, Android, Web) — Expo Router, RTL forced, Hebrew only
  server/    Node + TypeScript + Fastify — Better Auth, Drizzle ORM, PostgreSQL
packages/
  shared/    Zod schemas, enums, categories and regions shared by app and server
docs/
  ERD.md     Entity-relationship diagram (keep in sync with the schema)
```

## Prerequisites

- Node 22+ (developed on 24)
- Docker Desktop (local Postgres)

## First-time setup

```bash
npm install

# env files (never commit real values; this repo is public)
cp apps/server/.env.example apps/server/.env    # then set BETTER_AUTH_SECRET
cp apps/mobile/.env.example apps/mobile/.env

npm run db:up        # start Postgres in Docker
npm run db:migrate   # apply migrations
npm run db:seed      # seed vendor categories
```

## Daily development

```bash
npm run dev:server   # API on http://localhost:4000
npm run dev:web      # web app on http://localhost:8081
npm run dev:mobile   # Expo dev server (scan QR / open simulator)
```

In development, the **email sign-in code is printed in the server console**. Email delivery isn't wired up yet.
Google and Apple buttons appear automatically once their keys are set in `apps/server/.env`.

**Testing on a physical phone:** set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your PC's LAN IP, for example `http://192.168.1.20:4000`.

## Database workflow

1. Edit the schema in `apps/server/src/db/schema/`.
2. `npm run db:generate`: creates a SQL migration in `apps/server/drizzle/`.
3. Review the SQL, then `npm run db:migrate`.
4. Update `docs/ERD.md`.

Conventions: money is stored as integer **agorot**. A wedding is separate from users (`wedding_member` links them). Booked calendar slots can't overlap, which a Postgres exclusion constraint enforces.

## Checks

```bash
npm run typecheck
npm run lint -w @soon/mobile
```
