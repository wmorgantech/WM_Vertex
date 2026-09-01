# VertexWM — Smart Employee & Internship Management Platform

A role-based workforce management system for organizations to manage employees and interns: profiles, attendance, timesheets, tasks/projects, daily work updates, and productivity analytics.

## Tech Stack

- **Backend:** Node.js, Express, Prisma ORM, PostgreSQL, JWT auth (access + refresh tokens), role-based access control
- **Frontend:** React 18 (Vite), React Router, Recharts, Axios

## Roles

| Role | Description |
|---|---|
| **Super Admin** | Managing Director — full organizational oversight, analytics, reporting |
| **Admin** | Manager — manages employees, interns, attendance, tasks, approvals |
| **Employee / Intern** | Updates attendance, submits timesheets, completes tasks, reports daily progress |

## Modules

1. Employee Management — profiles, departments, onboarding, roles, employment status, org hierarchy
2. Intern Management — internship batches, mentor assignment, progress/performance tracking
3. Role-Based Access Control
4. Task & Project Management — daily/project tasks, priorities, deadlines, progress tracking
5. Daily Attendance — clock-in/out, history, late/absence tracking
6. Timesheet Management — hours per project/task, manager approval workflow
7. Daily Work Updates — end-of-day reports with manager feedback
8. Productivity Analytics — individual/team dashboards, completion metrics, trends
9. Reports & Monitoring — real-time dashboards, exportable data

## Project Structure

```
VertexWM/
├── backend/            Express API (Prisma + PostgreSQL)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── src/
│       ├── config/      Prisma client
│       ├── middleware/  auth, RBAC, error handling
│       ├── routes/      one file per module
│       ├── controllers/ business logic per module
│       └── app.js, server.js
└── frontend/           React (Vite) web app
    └── src/
        ├── api/, context/, routes/, layouts/
        ├── components/  common UI + charts
        └── pages/       one folder per module
```

## Prerequisites (Windows)

- **Node.js 18+** — https://nodejs.org
- **PostgreSQL 14+** — https://www.postgresql.org/download/windows/
  - During install, remember the `postgres` superuser password and the port (default `5432`).

## 1. Set up PostgreSQL

Open **pgAdmin** or **psql** and create a database:

```sql
CREATE DATABASE vertexwm;
```

## 2. Backend setup

```powershell
cd backend
copy .env.example .env
```

Edit `.env` and set `DATABASE_URL` to match your PostgreSQL credentials, e.g.:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/vertexwm?schema=public"
```

Install dependencies and set up the database:

```powershell
npm install
npx prisma migrate dev --name init
npm run seed
```

Start the API server:

```powershell
npm run dev
```

The API runs at `http://localhost:5111`. Health check: `http://localhost:5111/health`.

## 3. Frontend setup

Open a second terminal:

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

The web app runs at `http://localhost:5174` and talks to the API at `http://localhost:5111/api` (configurable via `VITE_API_URL` in `frontend/.env`).

## Creating the first account

The seed script only creates master/config data (employment types, leave types, expense categories, etc.) — it does **not** create any users. There is no default login. To create your first Super Admin account, run this once against your database (replace the email/password/name):

```powershell
cd backend
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
(async () => {
  const password = await bcrypt.hash('YOUR_STRONG_PASSWORD_HERE', 10);
  const user = await prisma.user.create({
    data: {
      email: 'you@yourcompany.com',
      password,
      firstName: 'Your',
      lastName: 'Name',
      role: 'SUPER_ADMIN',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
    },
  });
  console.log('Created Super Admin:', user.email);
  await prisma.\$disconnect();
})();
"
```

Every subsequent account (Admins, Employees, Interns) can then be created normally through the app itself — Employees → Add Employee (once logged in as this Super Admin).

## API Documentation (Swagger)

Interactive API docs are available at `http://localhost:5111/api-docs` (or your deployed API URL + `/api-docs`). Log in via the app or `POST /api/auth/login` to get an access token, then click **Authorize** in Swagger and paste it (as `Bearer <token>`) to test protected endpoints directly.

## Useful Commands

Backend (`backend/`):
- `npm run dev` — start API with auto-reload
- `npm run prisma:studio` — open Prisma Studio (visual DB browser)
- `npm run prisma:migrate` — create/apply a new migration after schema changes
- `npm run seed` — re-run the seed script (safe to re-run; only creates/upserts master/config data, never users)

Frontend (`frontend/`):
- `npm run dev` — start Vite dev server
- `npm run build` — production build (outputs to `frontend/dist`)
- `npm run preview` — preview the production build locally

## Notes

- JWT access tokens expire in 15 minutes by default; the frontend automatically refreshes them using the refresh token (7-day expiry). Both are configurable in `backend/.env`.
- All destructive/administrative actions (creating users, approving timesheets, reviewing work updates, etc.) are protected server-side by role checks — the frontend UI simply reflects what each role is permitted to do.
- This build was verified with `npm install` + `npm run build` for the frontend and `npm install` + Node syntax checks for the backend. Running `npx prisma generate` / `migrate` requires downloading Prisma's engine binaries, which happens automatically the first time you run the commands above on a machine with normal internet access.
