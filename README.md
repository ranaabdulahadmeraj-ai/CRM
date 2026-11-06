# Dream Land Properties — ERP & CRM

Next.js application for Dream Land Properties. The public homepage reads featured projects and available properties from the database; its consultation form creates CRM leads and customer records. The authenticated dashboard includes lead/customer history, persistent reminders, agent activity, appointment outcomes, installment schedules, commission agreements and financial reports.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set a unique `SESSION_SECRET` with at least 32 characters.
3. For a new local database, run `npx prisma db push` and `npx prisma generate`.
4. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` (minimum 12 characters), then run `npm run db:seed` to create the first administrator. The bootstrap script is non-destructive and does not add example business records.
5. Start the app with `npm run dev`.

Production builds run `prisma generate` before `next build` so the Prisma Client is available in cached deployment environments such as Vercel.

## Reminder scheduler

Due reminders are persisted in the CRM and become in-app notifications when the scheduler runs. Configure `CRON_SECRET` as a random secret of at least 32 characters, then configure an external scheduler (for example, your hosting provider's cron service) to send an authenticated `POST` to `/api/cron/reminders` at least once per minute:

```text
Authorization: Bearer <CRON_SECRET>
```

The endpoint creates each due reminder notification once and marks unpaid past-due installments overdue. The application does not run a background scheduler itself; without an external scheduled request, reminders remain saved but due notifications will not be generated. Email delivery is not enabled; notifications are available in the authenticated dashboard.

The checked-in Prisma schema currently uses SQLite for local development. Do not use the local SQLite database as a multi-instance production database; configure and migrate to a managed production database, backups, and secure file storage before deployment.

For an existing local installation, back up the SQLite file before applying the additive schema updates. Then run `npx prisma db push` and `npx prisma generate`; do not reset or reseed the database. Review and resolve any unique-index conflict reported for pre-existing duplicate customer contact records before retrying.

## Main routes

- `/` — public property and project listings plus consultation inquiry form
- `/login` — staff authentication
- `/dashboard` — role-scoped operations overview
- `/dashboard/projects`, `/dashboard/properties` — inventory management
- `/dashboard/leads`, `/dashboard/customers` — prospect and customer workflows
- `/dashboard/appointments`, `/dashboard/deals` — scheduling and transaction workflows
- `/dashboard/reminders` — assigned follow-ups, overdue alerts and in-app notifications
- `/dashboard/customers/{id}` — unified customer communication, appointment and transaction history
- `/dashboard/reports` — finance and operational summaries
- `POST /api/inquiry` — validated website-to-CRM inquiry endpoint

Public website integrations should submit inquiries to the public inquiry endpoint. Never expose database credentials or private CRM records in client-side code.
