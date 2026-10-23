# Flicks & Licks HRMS — Foundation

A Next.js 15 + Prisma + PostgreSQL starter using the supplied Flicks & Licks logo and red/black/white palette.

## Local setup
1. Install Node.js 20+ and PostgreSQL (or use a Railway PostgreSQL database).
2. `npm install`
3. Copy `.env.example` to `.env` and set `DATABASE_URL`.
4. `npx prisma migrate dev --name init`
5. `npm run dev` and visit http://localhost:3000.

## GitHub → Railway
1. Push this project folder to a private GitHub repository. Never commit `.env`.
2. In Railway, create a project and add a PostgreSQL service.
3. Add a service from your GitHub repository.
4. Set the web service `DATABASE_URL` to the PostgreSQL service's internal `DATABASE_URL` reference in Railway's Variables UI.
5. Set the build command to `npm run build` and start command to `npm run start`.
6. Apply database migrations via `npx prisma migrate deploy` as a controlled release step (e.g. Railway pre-deploy command). Create the first migration locally and commit the generated `prisma/migrations` directory before deployment.
7. Generate a Railway public domain and verify `/api/health`.

## Current scope and security
This is a branded navigation/UI and database schema **foundation**, not a production-ready HR system. It intentionally displays no fabricated employee records. Employee API endpoints return 401 until secure sign-in, sessions, and role-based authorization are implemented. Do **not** enter actual employee, payroll, or disciplinary data until authentication, permissions, validation, audit logging, backups and data protection are completed. Do not make sensitive HR data public.

## Planned 11 modules
Employee Management, Payroll & Benefits, Leave Management, Training & Development, Recruitment, Performance Appraisal, Onboarding & Exit, Disciplinary Management, Rewards & Recognition, Employee Self-Service, Access & Audit Controls.
