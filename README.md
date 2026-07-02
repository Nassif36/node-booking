# 🏠 Booking AR — Vacation Rental Platform API

Production-ready REST API for a vacation rental booking platform targeting Argentina, built with NestJS 10, PostgreSQL, Redis, and Mercado Pago.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
  - [Docker Compose (recommended)](#docker-compose-recommended)
  - [Local development](#local-development)
  - [Frontend (built-in)](#frontend-built-in)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [API Overview](#api-overview)
  - [Authentication](#authentication)
  - [Users](#users)
  - [Properties](#properties)
  - [Bookings](#bookings)
  - [Payments](#payments)
  - [Health](#health)
- [Authentication Flow](#authentication-flow)
- [Booking Flow](#booking-flow)
- [Payment Flow](#payment-flow)
- [Pricing Engine](#pricing-engine)
- [Notifications](#notifications)
- [Role-Based Access Control](#role-based-access-control)
- [Testing](#testing)
- [Swagger Documentation](#swagger-documentation)
- [Docker](#docker)
- [Scripts Reference](#scripts-reference)

---

## Features

- **JWT auth** with short-lived access tokens + rotating refresh tokens
- **Transactional booking overlap prevention** via PostgreSQL advisory locks (`pg_advisory_xact_lock`)
- **Mercado Pago** checkout preference creation and HMAC-SHA256 signed webhook processing
- **Idempotent payment events** — duplicate webhooks are safely ignored
- **Decimal.js pricing engine** — zero floating-point rounding errors on ARS amounts
- **Seasonal pricing** — per-date rate overrides on top of base nightly price
- **Async email notifications** via BullMQ + Nodemailer (booking confirmed / cancelled)
- **RBAC** — `ADMIN`, `OWNER`, `GUEST` roles with guard-enforced route protection
- **Swagger/OpenAPI** auto-generated docs at `/api/docs`
- **Health checks** — liveness & readiness probes (PostgreSQL + Redis)
- **Docker & Docker Compose** — one-command production deployment

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, TypeScript 5 |
| Framework | NestJS 10 |
| Database | PostgreSQL 15 + Prisma ORM |
| Cache / Queue | Redis 7 + BullMQ |
| Auth | Passport.js, `passport-jwt`, `@nestjs/jwt` |
| Payments | Mercado Pago SDK v2 (`mercadopago`) |
| Email | Nodemailer |
| Validation | `class-validator` + `class-transformer` |
| Docs | Swagger (`@nestjs/swagger`) |
| Precision math | `decimal.js` |
| Testing | Jest + ts-jest + Supertest |
| Containers | Docker + Docker Compose |

---

## Project Structure

```
node-booking/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── nest-cli.json
├── prisma/
│   └── schema.prisma          ← All database models
└── src/
    ├── main.ts                ← Bootstrap (Swagger, pipes, filters)
    ├── app.module.ts          ← Root module with BullMQ config
    ├── config/
    │   └── configuration.ts  ← Typed env config factory
    ├── prisma/
    │   ├── prisma.module.ts   ← Global PrismaModule
    │   └── prisma.service.ts  ← PrismaClient wrapper
    ├── common/
    │   ├── decorators/        ← @CurrentUser, @Roles, @Public
    │   ├── guards/            ← JwtAuthGuard, RolesGuard
    │   ├── interceptors/      ← ResponseInterceptor (unified response shape)
    │   └── exceptions/        ← HttpExceptionFilter (unified error shape)
    └── modules/
        ├── auth/              ← register, login, refresh, logout
        ├── users/             ← profile CRUD
        ├── properties/        ← listings, images, seasonal pricing, search
        ├── bookings/
        │   ├── services/
        │   │   └── pricing.service.ts  ← Decimal.js pricing engine
        │   └── ...
        ├── payments/          ← MP checkout + webhook
        ├── notifications/     ← BullMQ processor + Nodemailer
        └── health/            ← /liveness + /readiness
```

---

## Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Docker setup)
- Or: PostgreSQL 15 + Redis 7 running locally

---

## Quick Start

### Docker Compose (recommended)

```bash
# 1. Clone and enter the project
git clone <your-repo-url>
cd node-booking

# 2. Configure environment
cp .env.example .env
# Edit .env with your Mercado Pago credentials and email settings

# 3. Start everything (app + postgres + redis)
docker compose up --build

# API: http://localhost:3000/api/v1
# Docs: http://localhost:3000/api/docs
# Frontend: http://localhost:3000
```

The container entrypoint automatically runs `prisma migrate deploy` before starting the app.

### Local development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit DATABASE_URL, REDIS_HOST, JWT secrets, etc.

# 3. Generate Prisma client
npm run prisma:generate

# 4. Run migrations
npm run prisma:migrate

# 5. Start dev server (hot reload)
npm run start:dev

# API: http://localhost:3000/api/v1
# Docs: http://localhost:3000/api/docs
# Frontend: http://localhost:3000
```

---

### Frontend (built-in)

This repository now includes a minimal frontend in `/public` served by NestJS at the root URL.

```bash
# Optional: customize API base URL for the frontend
cp public/config.example.js public/config.js

# Start backend + frontend
npm run start:dev
```

Open `http://localhost:3000` to use the UI.

Implemented user flows:
- Register / login / logout
- Search properties with filters
- View property details
- Get booking quote
- Create booking
- List authenticated user bookings

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Application
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/booking_db"

# JWT — CHANGE THESE IN PRODUCTION
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=your-mercadopago-access-token
MERCADOPAGO_WEBHOOK_SECRET=your-mercadopago-webhook-secret
MERCADOPAGO_SUCCESS_URL=http://localhost:3000/payment/success
MERCADOPAGO_FAILURE_URL=http://localhost:3000/payment/failure
MERCADOPAGO_PENDING_URL=http://localhost:3000/payment/pending
MERCADOPAGO_NOTIFICATION_URL=http://localhost:3000/api/v1/payments/webhook

# Email (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@booking.ar
```

> **Security note:** Never commit `.env` to version control. It is already listed in `.gitignore`.

---

## Database

### Schema models

| Model | Description |
|---|---|
| `User` | Platform users with `ADMIN`, `OWNER`, `GUEST` roles |
| `RefreshToken` | Stored JWT refresh tokens (revocable, expiry tracked) |
| `Property` | Rental listings with pricing, location, amenities |
| `PropertyImage` | Multiple images per property, one marked as primary |
| `SeasonalPricing` | Date-range price overrides (e.g., holiday rates) |
| `Booking` | Reservations with status: `PENDING → CONFIRMED → COMPLETED / CANCELLED` |
| `PaymentEvent` | Mercado Pago webhook records with idempotency key (`externalId`) |

### Useful Prisma commands

```bash
# Create a new migration
npm run prisma:migrate

# Apply migrations (production)
npm run prisma:migrate:prod

# Open Prisma Studio (GUI)
npm run prisma:studio

# Regenerate Prisma client after schema changes
npm run prisma:generate
```

---

## API Overview

All endpoints are prefixed with `/api/v1`. All responses follow this envelope:

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": { ... },
  "timestamp": "2026-06-13T00:00:00.000Z"
}
```

Errors follow:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["email must be an email"],
  "path": "/api/v1/auth/register",
  "method": "POST",
  "timestamp": "2026-06-13T00:00:00.000Z"
}
```

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register a new user |
| `POST` | `/auth/login` | Public | Login and receive token pair |
| `POST` | `/auth/refresh` | Refresh token | Rotate tokens |
| `POST` | `/auth/logout` | Bearer | Revoke refresh token |

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users` | ADMIN | List all users |
| `GET` | `/users/me` | Bearer | Get own profile |
| `GET` | `/users/:id` | Bearer | Get user by ID |
| `PATCH` | `/users/:id` | Bearer | Update profile (own, or any for ADMIN) |
| `DELETE` | `/users/:id` | ADMIN | Deactivate a user |

### Properties

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/properties` | Public | Search / list available properties |
| `GET` | `/properties/:id` | Public | Get property details |
| `POST` | `/properties` | OWNER/ADMIN | Create a listing |
| `GET` | `/properties/owner/my-properties` | OWNER/ADMIN | List own properties |
| `PATCH` | `/properties/:id` | OWNER/ADMIN | Update a listing |
| `DELETE` | `/properties/:id` | OWNER/ADMIN | Deactivate a listing |
| `POST` | `/properties/:id/images` | OWNER/ADMIN | Add image |
| `DELETE` | `/properties/:id/images/:imageId` | OWNER/ADMIN | Remove image |
| `POST` | `/properties/:id/seasonal-pricing` | OWNER/ADMIN | Add seasonal rate |
| `DELETE` | `/properties/:id/seasonal-pricing/:pricingId` | OWNER/ADMIN | Remove seasonal rate |

#### Search query parameters

| Param | Type | Example | Description |
|---|---|---|---|
| `city` | string | `Buenos Aires` | Case-insensitive city filter |
| `province` | string | `Mendoza` | Case-insensitive province filter |
| `checkIn` | date | `2026-07-01` | Filters out properties with overlapping bookings |
| `checkOut` | date | `2026-07-08` | Used with `checkIn` |
| `guests` | number | `3` | Minimum `maxGuests` capacity |
| `minPrice` | number | `5000` | Minimum base price per night (ARS) |
| `maxPrice` | number | `30000` | Maximum base price per night (ARS) |
| `page` | number | `1` | Page number (default: 1) |
| `limit` | number | `10` | Results per page (max 50, default: 10) |

### Bookings

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/bookings` | Bearer | Create a booking |
| `GET` | `/bookings/quote` | Bearer | Price quote (no booking created) |
| `GET` | `/bookings/my-bookings` | Bearer | Guest's own bookings |
| `GET` | `/bookings/owner-bookings` | Bearer | All bookings on owner's properties |
| `GET` | `/bookings/:id` | Bearer | Booking detail (guest/owner/admin) |
| `PATCH` | `/bookings/:id/cancel` | Bearer | Cancel a booking |

### Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/payments/checkout/:bookingId` | Bearer | Create MP checkout preference |
| `POST` | `/payments/webhook` | Public (HMAC) | Mercado Pago IPN webhook |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health/liveness` | Public | Process alive check |
| `GET` | `/health/readiness` | Public | DB + Redis connectivity check |

---

## Authentication Flow

```
1. POST /auth/register  →  { accessToken, refreshToken, user }
2. POST /auth/login     →  { accessToken, refreshToken, user }
3. Use Authorization: Bearer <accessToken> on all protected routes
4. When accessToken expires (15m):
   POST /auth/refresh { refreshToken }  →  { accessToken, refreshToken }
   (old refresh token is revoked — rotation prevents replay attacks)
5. POST /auth/logout { refreshToken }  →  204 (token revoked)
```

---

## Booking Flow

```
1. Guest searches properties: GET /properties?city=...&checkIn=...&checkOut=...
2. Get price quote: GET /bookings/quote?propertyId=...&checkIn=...&checkOut=...&guests=2
3. Create booking: POST /bookings  →  { id, status: "PENDING", totalPrice, priceBreakdown }
4. Pay: POST /payments/checkout/:bookingId  →  { checkoutUrl }
5. Guest completes payment on Mercado Pago
6. MP calls POST /payments/webhook
7. Booking status → "CONFIRMED", confirmation email sent
```

---

## Payment Flow

```
POST /payments/checkout/:bookingId
  └── Creates Mercado Pago Preference
  └── Returns { preferenceId, checkoutUrl, sandboxUrl }

[Guest pays on MP checkout page]

POST /payments/webhook  (called by Mercado Pago)
  ├── Verifies HMAC-SHA256 signature (x-signature header)
  ├── Checks PaymentEvent.externalId for idempotency
  ├── Fetches full payment details from MP API
  ├── Upserts PaymentEvent record
  ├── If APPROVED  → Booking status = CONFIRMED
  ├── If REJECTED  → Booking status = CANCELLED
  └── Queues confirmation email via BullMQ
```

---

## Pricing Engine

The `PricingService` uses **Decimal.js** to avoid floating-point arithmetic errors common with ARS amounts.

**Algorithm:**

1. For each night of the stay (checkIn to checkOut), determine the applicable rate:
   - If the date falls within a `SeasonalPricing` period → use `pricePerNight`
   - Otherwise → use the property's `basePrice`
2. Sum all nightly rates → `nightlyTotal`
3. Add `cleaningFee` (one-time, not per-night) → `total`

**Example response:**

```json
{
  "nights": 7,
  "nightlyRate": "12857.14",
  "nightlyTotal": "90000.00",
  "cleaningFee": "3000.00",
  "total": "93000.00",
  "currency": "ARS",
  "perNightDetail": [
    { "date": "2026-07-01", "rate": "10000.00" },
    { "date": "2026-07-02", "rate": "10000.00" },
    { "date": "2026-07-03", "rate": "20000.00" }
  ]
}
```

---

## Notifications

Notifications run **asynchronously** via BullMQ to avoid blocking HTTP responses.

**Queue name:** `notifications`  
**Jobs:**
- `booking-confirmation` — sent when payment is approved
- `booking-cancellation` — sent when a booking is cancelled

**Retry policy:** 3 attempts, exponential backoff starting at 1 second.

Email templates are inline HTML in Spanish (Argentina locale), with a plain-text fallback.

To use Gmail, create an [App Password](https://myaccount.google.com/apppasswords) and set it in `EMAIL_PASSWORD`.

---

## Role-Based Access Control

| Role | Capabilities |
|---|---|
| `GUEST` | Register, search properties, create/view/cancel own bookings, pay |
| `OWNER` | Everything GUEST can do + create/manage own property listings |
| `ADMIN` | Full access to all users, properties, bookings |

Routes are protected by two guards applied globally:
- `JwtAuthGuard` — validates Bearer token (skipped for `@Public()` routes)
- `RolesGuard` — enforces `@Roles(Role.OWNER, ...)` decorator

---

## Testing

### Unit tests

```bash
# Run all unit tests
npm test

# Watch mode
npm run test:watch

# With coverage report
npm run test:cov
```

Unit test files:
- `src/modules/bookings/services/pricing.service.spec.ts` — 12 tests covering all pricing scenarios
- `src/modules/bookings/bookings.service.spec.ts` — 11 tests covering create, findOne, cancel

### E2E tests

Requires running PostgreSQL and Redis instances (use Docker Compose):

```bash
docker compose up db redis -d
npm run test:e2e
```

E2E test file: `test/app.e2e-spec.ts` — covers health, auth register/login, and property search.

---

## Swagger Documentation

Available at **`http://localhost:3000/api/docs`** in `development` and `test` environments (disabled in `production`).

Features:
- Bearer token authentication (persistent across page reloads)
- All endpoints documented with request/response schemas
- Try-it-out for every endpoint

---

## Docker

### Build image

```bash
docker build -t booking-ar .
```

### Multi-stage Dockerfile

| Stage | Purpose |
|---|---|
| `builder` | Installs all deps, generates Prisma client, compiles TypeScript |
| `production` | Copies only `dist/`, production `node_modules`, and Prisma artifacts |

Final image is based on `node:20-alpine` (~small footprint).

### docker-compose services

| Service | Image | Port |
|---|---|---|
| `app` | Built from `Dockerfile` | `3000` |
| `db` | `postgres:15-alpine` | `5432` |
| `redis` | `redis:7-alpine` | `6379` |

```bash
# Start all services
docker compose up

# Rebuild app after code changes
docker compose up --build app

# Stop and remove containers
docker compose down

# Stop and remove containers + volumes (wipes data)
docker compose down -v
```

---

## Scripts Reference

```bash
npm run start:dev        # Start with hot-reload
npm run start:prod       # Start compiled production build
npm run build            # Compile TypeScript → dist/
npm run test             # Run unit tests
npm run test:cov         # Unit tests with coverage
npm run test:e2e         # End-to-end tests
npm run prisma:generate  # Regenerate Prisma client
npm run prisma:migrate   # Create + apply new migration (dev)
npm run prisma:migrate:prod  # Apply pending migrations (prod)
npm run prisma:studio    # Open Prisma Studio GUI
npm run lint             # ESLint + auto-fix
npm run format           # Prettier format
```
