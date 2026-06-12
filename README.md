# GLIM — Multi-tenant BSchool Portal

A MERN-stack portal where business schools run as isolated **organizations**.
Students track **deadlines & assignment submissions**, receive **email
reminders**, and keep a **personal, end-to-end encrypted to-do list**.

```
TaskPlanner/
├── backend/     Express + MongoDB (Mongoose) REST API
├── frontend/    React + Vite + Material UI (MUI) single-page app
└── docs/        Architecture docs (see DATA_MODEL.md)
```

> 📐 **Database structure, collections, relationships and an ER diagram:**
> [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)

---

## Roles

Roles are a **base identity tier** (below) with a **customizable permission layer**
on top — see [Roles & permissions](#roles--permissions).

| Role | Scope | Can do |
| ---- | ----- | ------ |
| **Owner** | Platform | Create organizations (auto-generates `admin@<domain>` + an active semester), disable/reactivate/delete them, and define **platform roles** for all domains. |
| **Admin** | One organization | Manage members **only on the org's email domain**; manage semesters, courses & groups; create **custom org roles**; post assignments for any course. |
| **Moderator** | Per **course** | Post & maintain assignments **only for the courses they moderate** (subject-level). |
| **Student** | One program + section | View & track assignments for their program/section; can be promoted to course moderator. |

**Organization clustering** is by email domain: every member of `acme.edu` shares
one organization. Disabling an organization blocks all of its members from
logging in (the owner is never blocked) without deleting any data.

### Roles & permissions

Authorization is **permission-based**, layered over the base role:

- A **curated capability catalog** (`config/permissions.js`) — e.g. `user:manage`,
  `course:manage`, `semester:manage`, `group:manage`, `assignment:manage`,
  `role:manage`. Every permission gates real code.
- **Custom roles** bundle permissions. The **owner** creates *platform* roles (all
  domains); an **admin** creates *organization* roles (their domain only) and
  assigns them to members — e.g. a "Coordinator" with `course:manage` + `group:manage`.
- **Course moderation is subject-level**: adding a user to a course's `moderators`
  list *is* the grant — they can author assignments for that course only. A plain
  **student can be promoted** to moderate a subject without changing their base role.

### Semesters & courses

Courses and groups belong to a **semester**. An admin **starts a new semester**
(password-confirmed) which **archives** the previous term's assignments & groups
(non-destructive, scoped — not deleted) and opens a fresh one. **Personal to-do
boards are never touched.** Admins add courses, assign course moderators, and
**auto-generate student groups** by program/section and size.

---

## Features

- **Multi-tenant organizations** — domain-based clustering with a single platform owner.
- **Pre-generated passwords** — accounts get a strong password, emailed automatically
  via EmailJS (or shown in-app if email isn't configured); users change it on first login.
- **Program & Section scoping** — Program (PGPM / PGDM / MBA — extend in
  `config/academics.js`) and Section (1 / 2 / 3) drive who sees each assignment.
  Section-specific assignments appear only to students in those sections.
- **Email reminders** — a `node-cron` job sweeps every 15 minutes and emails the
  right students (same org + program, matching sections) before a deadline.
- **End-to-end encrypted personal to-dos** — a Jira-style **Kanban board** (To Do /
  In Progress / Done) with drag-and-drop between columns; the status lives inside
  the encrypted payload. See the dedicated section below.
- **Groups & shared boards** — members create groups (adding others by their org
  email) and coordinate group assignments on a shared task board with per-task
  assignees and completion. *Shared boards are server-stored, not E2E* (multi-user
  E2E needs key exchange) — keep private notes in your personal list.
- **Assignment completion tracking** — students mark assignments done; the flag is
  personal and reflected on deadlines & the dashboard.
- **Self-service profile** — every user can update their name & phone; admins set
  academic fields (program, section, roll number, enrollment year, phone).
- **Hardened API** — `helmet` security headers, tiered rate limiting
  (global / auth / write), regex-escaped search, and graceful shutdown.
- **Cached data layer** — all data fetching goes through **React Query**
  (`@tanstack/react-query`): responses are cached and shared across pages
  (revisiting a screen is instant), mutations invalidate the relevant caches, and
  list updates are optimistic.
- **Dark mode** + responsive MUI UI from mobile to desktop, with a top-level
  error boundary so a render error can't white-screen the app.

---

## Prerequisites

- **Node.js ≥ 18** (developed on Node 24)
- A **MongoDB** database (the provided `.env` points at a MongoDB Atlas cluster)

> **Atlas note:** if you see `Could not connect to any servers… IP that isn't
> whitelisted`, add your current IP (or `0.0.0.0/0` for local dev) under
> **Atlas → Network Access**. The app code is fine — Atlas simply rejects
> connections from non-allowlisted IPs.

---

## Quick start

Open two terminals.

### 1. Backend

```bash
cd backend
npm install
npm run seed     # creates the owner + a demo organization (glim.edu) with sample data
npm run dev      # starts the API on http://localhost:5001
```

`npm run seed` provisions the **platform owner** plus a demo organization and
prints every account's credentials, e.g.:

```
organization: GLIM (Demo)  (@glim.edu)
+ owner     atharvadeshpande@owner.com   password: Admin@12345
+ admin     admin@glim.edu               password: Admin@12345
+ moderator maya.iyer@glim.edu           password: <generated>
+ student   aarav.sharma@glim.edu        password: <generated>   (PGDM, Sec 1)
+ student   diya.patel@glim.edu          password: <generated>   (PGDM, Sec 2)
+ student   rohan.mehta@glim.edu         password: <generated>   (MBA,  Sec 1)
```

> The database name defaults to `glim` (set via the `dbName` connect option, so
> a copy-pasted Atlas URI without a DB path still works). Override with
> `MONGODB_DB` if needed.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev      # starts the app on http://localhost:5173
```

The Vite dev server proxies `/api/*` to the backend, so just open
<http://localhost:5173>. Sign in as the **owner** to manage organizations, or as
`admin@glim.edu` to manage the demo org's users and assignments. Each role lands
on its own home screen.

---

## Environment variables (`backend/.env`)

| Variable              | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `PORT`                | API port (default `5001`; 5000 is taken by macOS AirPlay)        |
| `CLIENT_URL`          | Comma-separated allowed browser origins (CORS + email links)     |
| `MONGODB_URI`         | MongoDB connection string                                        |
| `MONGODB_DB`          | Database name (default `glim`)                                   |
| `JWT_SECRET`          | Secret for signing JWTs — **change in production**               |
| `JWT_EXPIRES_IN`      | Token lifetime (default `7d`)                                    |
| `OWNER_*`             | Bootstrap platform owner created by `npm run seed`               |
| `EMAILJS_*`           | EmailJS service/keys/template IDs for sending email              |
| `REMINDER_LEAD_HOURS` | How many hours before a deadline to send a reminder              |

**Email via EmailJS:** all notifications are sent through the
[EmailJS](https://www.emailjs.com) REST API. While the `EMAILJS_*` values are
placeholders, the server still runs — emails are **logged to the console**
instead of being sent, and generated passwords are also returned to the admin UI
so accounts stay usable. To go live: create one template per notification
(welcome, reset, reminder, assignment, group), enable *"Allow EmailJS API for
non-browser applications"*, and fill the `EMAILJS_*` vars. Templates receive
these params: `to_email`, `to_name`, `subject`, `message`, `cta_url`,
`cta_label`, plus type-specific fields (`password`, `login_url`,
`assignment_title`, `course`, `due_at`, `program`, `group_name`, `added_by`).

**Notifications implemented:** account created (welcome + temp password),
admin password reset, deadline reminder (cron), new assignment posted (to
targeted students), and added-to-a-group.

---

## How the to-do encryption works (true end-to-end)

The personal to-do board is **end-to-end encrypted**: the server never sees the
key or any plaintext — only the signed-in user, in their own browser, can read it.

1. On login the browser derives a 256-bit **AES-GCM** key from the user's
   **password** using **PBKDF2** (250k iterations, SHA-256) plus a per-user
   `encSalt` (the salt is not secret; the server stores it and a bcrypt hash of
   the password — neither reveals the key).
2. Every to-do (title, notes, due date, board status) is encrypted **in the
   browser** before being sent to the API — so even which Kanban column a card
   sits in is private. The server stores only opaque `ciphertext` + `iv`.
3. The key is cached in `sessionStorage` (survives a refresh, cleared when the
   tab closes). On a fresh tab the board shows an **unlock** prompt to re-enter
   the password and re-derive the key locally.
4. **Changing the password** changes the key, so the client decrypts existing
   todos with the old key and re-encrypts them with the new one in the same
   request — the board survives the change without the server seeing plaintext.

> Because the key is derived from the password, an **admin password reset** makes
> the old ciphertext unrecoverable — so a reset clears that user's encrypted
> board (the admin UI warns before doing so). This is the deliberate trade-off of
> zero-knowledge E2E: the server genuinely cannot recover the data.

---

## API overview

All routes are under `/api`. Protected routes require `Authorization: Bearer <token>`.

| Method | Endpoint                          | Role            | Description                              |
| ------ | --------------------------------- | --------------- | ---------------------------------------- |
| POST   | `/auth/login`                     | public          | Log in, receive JWT + profile            |
| GET    | `/auth/me`                        | any             | Current user                             |
| PATCH  | `/auth/profile`                   | any             | Update own name & phone                  |
| POST   | `/auth/change-password`           | any             | Change password (+ rotate todos)         |
| GET    | `/organizations`                  | owner           | List orgs + member-count summary         |
| POST   | `/organizations`                  | owner           | Create org (+ auto `admin@<domain>`)     |
| PATCH  | `/organizations/:id/status`       | owner           | Disable / reactivate org                 |
| DELETE | `/organizations/:id`              | owner           | Permanently delete org (cascade)         |
| GET    | `/assignments?scope=`             | any (org/role)  | List assignments scoped to user          |
| POST   | `/assignments`                    | moderator/admin | Create assignment (program + sections)   |
| PATCH  | `/assignments/:id`                | moderator/admin | Update assignment                        |
| DELETE | `/assignments/:id`                | moderator/admin | Delete assignment                        |
| PATCH  | `/assignments/:id/progress`       | member          | Mark assignment done/not-done (personal) |
| GET    | `/todos`                          | any             | List own encrypted to-dos                |
| POST   | `/todos`                          | any             | Create encrypted to-do                   |
| PUT    | `/todos/:id`                      | any             | Update encrypted to-do                   |
| DELETE | `/todos/:id`                      | any             | Delete to-do                             |
| GET    | `/groups`                         | member          | List groups you belong to                |
| POST   | `/groups`                         | member          | Create group (+ add members by email)    |
| GET    | `/groups/:id`                     | group member    | Group details & members                  |
| PATCH  | `/groups/:id`                     | group owner     | Rename / edit group                      |
| DELETE | `/groups/:id`                     | group owner     | Delete group (cascades board)            |
| POST   | `/groups/:id/members`             | group owner     | Add members by email                     |
| DELETE | `/groups/:id/members/:userId`     | owner or self   | Remove member / leave group              |
| GET    | `/groups/:id/todos`               | group member    | List shared tasks                        |
| POST   | `/groups/:id/todos`               | group member    | Add shared task                          |
| PATCH  | `/groups/:id/todos/:todoId`       | group member    | Update / complete shared task            |
| DELETE | `/groups/:id/todos/:todoId`       | group member    | Delete shared task                       |
| GET    | `/users`                          | admin           | List users in own organization           |
| POST   | `/users`                          | admin           | Create user on own domain (+ password)   |
| PATCH  | `/users/:id`                      | admin           | Update user (role/program/section/roll)  |
| POST   | `/users/:id/reset-password`       | admin           | Reset password                           |
| DELETE | `/users/:id`                      | admin           | Delete user                              |
| GET    | `/roles`                          | role:manage(:global) | List roles in scope + permission catalog |
| POST/PATCH/DELETE | `/roles[/:id]`         | role:manage(:global) | Create / edit / delete custom roles      |
| PUT    | `/roles/assign`                   | role:manage     | Assign custom roles to a member          |
| GET    | `/semesters` · `/semesters/active`| any (org)       | List terms / get the active term         |
| POST   | `/semesters/start`                | semester:manage | Start a new term (password-confirmed)    |
| GET    | `/courses`                        | any (org)       | List courses in a term                   |
| POST/PATCH/DELETE | `/courses[/:id]`       | course:manage   | Create / edit / delete courses           |
| PUT    | `/courses/:id/moderators`         | course:manage   | Set a course's moderators                |
| POST   | `/groups/generate`                | group:manage    | Auto-generate student groups             |
| POST/PATCH/DELETE | `/assignments[/:id]`   | course-scoped   | Author assignments (admin org-wide; moderators per course) |

Scoping is enforced server-side via the permission engine: admins act only within
their own organization & domain; **course moderators** post only for their
assigned courses; students see only their program's assignments (plus any
targeting their section). All course/assignment/group queries are scoped to the
**active semester**.

> **Upgrading an existing database?** Run `npm run migrate` once — it backfills a
> "Current" semester, converts free-text courses into `Course` documents, and
> stamps existing assignments & groups with the active term.

---

## Dev vs Prod modes

The frontend reads its API target from Vite env files, so you can run/test
either environment locally. For now **both point at the same local backend**;
when you add a separate prod backend, just change `VITE_API_BASE_URL` in
`frontend/.env.production`.

| Command (in `frontend/`) | Mode | API target | Use |
| ------------------------ | ---- | ---------- | --- |
| `npm run dev`            | development | `/api` (Vite proxy → :5001) | normal local dev |
| `npm run dev:prod`       | production  | `http://localhost:5001/api` | test the prod config locally |
| `npm run build`          | production  | from `.env.production` | prod bundle |
| `npm run build:dev`      | development | from `.env.development` | dev bundle |

A **DEV / PROD badge** in the top bar (and on the login screen) always shows the
active mode and the API it's hitting. The backend can run in prod mode with
`npm run start:prod` (sets `NODE_ENV=production`), and its CORS allow-list
(`CLIENT_URL`, comma-separated) already covers the dev server (5173) and the
prod preview (4173).

---

## Production build

```bash
cd frontend && npm run build      # outputs static assets to frontend/dist
cd backend  && npm run start:prod # serves the API in production mode
```

Serve `frontend/dist` from any static host and point `VITE_API_BASE_URL` at your
API; add the static host's origin to the backend `CLIENT_URL` list.

---

## Security & privacy notes

- The committed `backend/.env` contains real-looking credentials and a dev
  `JWT_SECRET`. **Rotate these and never commit real secrets** in a real
  deployment — `.env` is git-ignored by default here.
- **RBAC on every route:** all endpoints are behind `protect`; owner/admin/
  moderator/student actions are role-gated and **tenant-scoped** (no cross-org
  access; admins are locked to their email domain).
- **Tiered rate limiting** (per IP, 15-min windows): global `600` on `/api`,
  `20` on auth endpoints, `120` on sensitive write routes. See
  `middleware/rateLimit.js`.
- **`helmet`** security headers; **NoSQL-injection sanitizer** strips `$`/dotted
  keys from request bodies; search input is regex-escaped (no ReDoS).
- Configurable **multi-origin CORS**; graceful shutdown on `SIGINT`/`SIGTERM`.
- Passwords hashed with bcrypt (cost 12); JWTs short-lived and verified per
  request; generic login errors (no account enumeration). Deleting a user or org
  cascades all related data (todos, group boards, progress).
- **Privacy:** the personal to-do board is encrypted client-side with a per-user
  key returned only to its owner (see "How the to-do encryption works"). Group
  boards are shared, so server-readable — clearly disclosed in the UI. The owner
  sees only aggregate org counts, never individual users' data.
- **Forgot password:** an admin can reset any member's password from
  *Manage Users → reset* (emails a new temporary password; the user changes it
  on next login). Because the to-do board is end-to-end encrypted with a key
  derived from the password, a reset **clears that user's encrypted board** (the
  UI warns first) — the server genuinely cannot recover it.
