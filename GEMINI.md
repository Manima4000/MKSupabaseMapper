# CLAUDE.md — MemberKit → Supabase Sync Project

## What this project does

This service syncs data from the **MemberKit** LMS platform into a **Supabase** (PostgreSQL) database. The goal is to:

1. Have a centralized, queryable database of all students, their enrollments, and their progress
2. Receive real-time updates via **MemberKit webhooks**
3. Enable personalized student tracking and activity dashboards

The system runs as a **Fastify HTTP server** that receives webhooks, and also exposes a **CLI command** for full initial synchronization.

---

## Project structure

```
SupabaseProject/
├── .env                          # Environment variables (never commit)
├── .gitignore
├── docker-compose.yml            # Runs the service in Docker
└── memberkitsync/                # Main application
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── server.ts             # Fastify entrypoint
        ├── config/
        │   ├── env.ts            # Zod validation of all env vars
        │   └── supabase.ts       # Supabase client singleton (service_role)
        ├── shared/
        │   ├── types.ts          # All DB table/view types (mirrors schema exactly)
        │   ├── errors.ts         # Custom error classes
        │   ├── logger.ts         # Pino logger (pretty in dev, JSON in prod)
        │   └── pagination.ts     # fetchAllPages() helper for paginated MK endpoints
        ├── modules/              # One folder per domain entity
        │   ├── users/
        │   ├── courses/
        │   ├── sections/
        │   ├── lessons/
        │   ├── classrooms/
        │   ├── memberships/
        │   ├── enrollments/
        │   └── progress/
        ├── sync/
        │   ├── memberkit-api.client.ts   # HTTP client for MemberKit REST API
        │   ├── sync.orchestrator.ts      # Orchestrates a full sync in FK order
        │   └── sync.command.ts           # CLI entry point (npm run sync)
        └── webhooks/
            ├── webhook.types.ts          # Typed event envelopes
            ├── webhook.validator.ts      # HMAC-SHA256 signature + payload parsing
            ├── webhook.handler.ts        # Dispatcher: routes events to services
            └── webhook.routes.ts         # POST /webhooks/memberkit
```

---

## Module pattern

Every domain entity follows the same 4-file pattern:

```
{entity}.types.ts       — input DTOs + re-exports from shared/types.ts
{entity}.mapper.ts      — MemberKit API payload → input DTO
{entity}.repository.ts  — Supabase CRUD (upsert by mk_id)
{entity}.service.ts     — business logic (only entities that need it)
```

### Why this pattern?

- **Mapper** is the only file that knows about MemberKit's API shape. If MK changes their API, only the mapper changes.
- **Repository** is the only file that talks to Supabase. If we change the DB layer, only the repository changes.
- **Types** keep everything explicit and typed end-to-end with no `any`.
- **Service** composes mapper + repository and adds any business logic (e.g., syncing a course also syncs its sections and lessons).

### Which modules have a service?

| Module | Has service? | Why |
|---|---|---|
| users | yes | sync + resolve by mk_id |
| courses | yes | cascades into sections → lessons → videos/files |
| sections | no | only used internally by course.service |
| lessons | yes | exposes resolveLessonByMkId for webhook handler |
| classrooms | no | simple upsert |
| memberships | yes | syncs plans (with classroom links) and subscriptions |
| enrollments | no | simple upsert |
| progress | yes | handles lesson progress + user activity logging |

---

## Data flow

### Full sync (npm run sync)

```
MemberKitClient
    ↓ getCourses()
SyncOrchestrator.syncCatalog()
    → upsertCategory → upsertCourse → upsertSection → upsertLesson → upsertLessonVideo/Files

    ↓ getClassrooms()
SyncOrchestrator.syncClassrooms()
    → upsertClassroom

    ↓ getPlans()
SyncOrchestrator.syncPlans()
    → upsertMembershipLevel → linkMembershipLevelToClassroom

    ↓ getMembers() [paginated]
SyncOrchestrator.syncMembers()
    → upsertUser

    ↓ getSubscriptions() [paginated]
SyncOrchestrator.syncSubscriptions()
    → upsertMembership (resolves user and level by mk_id first)

    ↓ getEnrollments() [paginated]
SyncOrchestrator.syncEnrollments()
    → upsertEnrollment (resolves user, course, classroom by mk_id first)
```

The sync order **must** respect foreign key constraints:
`courses/categories` → `sections` → `lessons` → `classrooms` → `plans` → `members` → `subscriptions` → `enrollments`

### Webhook (real-time updates)

```
POST /webhooks/memberkit
    ↓ validateWebhookSignature (HMAC-SHA256, skipped if WEBHOOK_SECRET is empty)
    ↓ parseWebhookBody
    ↓ reply 200 immediately
    ↓ dispatchWebhook (async, non-blocking)
        → insertWebhookLog (status: received)
        → route by event type:
            member.created / member.updated   → syncUser
            subscription.*                    → syncSubscription
            enrollment.*                      → upsertEnrollment
            lesson_status_saved               → handleLessonProgress + logUserActivity
        → updateWebhookLog (status: processed | failed)
```

Webhooks respond **200 immediately** and process in the background to avoid MK sender timeouts on slow operations.

---

## Database schema

All migrations live in `src/database/migrations/`. Run them manually in the Supabase dashboard (SQL Editor) **before** the first sync.

| File | What it does |
|---|---|
| `001_create_tables.sql` | Creates all 17 tables |
| `002_create_indexes.sql` | Indexes for all common query patterns |
| `003_functions_and_views.sql` | Views for progress tracking + SQL functions |
| `004_create_rls_policies.sql` | Row Level Security (service_role = full access, anon = read catalog) |

### Tables

**Content catalog**
- `categories` — course groupings
- `courses` — courses (e.g., "Matemática 1 - ESA")
- `sections` — modules inside a course
- `lessons` — individual classes inside a section
- `lesson_videos` — 1:1 with lessons (stores video uid, source, duration)
- `lesson_files` — 1:N with lessons (stores filename + URL)

**Subscriptions & Classrooms**
- `classrooms` — MK member areas / turmas
- `membership_levels` — subscription plans (e.g., "Assinatura ESA")
- `membership_level_classrooms` — N:N junction between plans and classrooms

**Students**
- `users` — student records
- `memberships` — student ↔ plan subscriptions
- `enrollments` — student ↔ course ↔ classroom

**Tracking**
- `lesson_progress` — per-lesson completion % per student (upserted by user_id + lesson_id)
- `user_activities` — append-only log of all webhook events per student
- `comments` — lesson comments (created via webhook)
- `quiz_attempts` — quiz scores
- `webhook_logs` — full audit trail of every webhook received (supports replay)

### Key design decisions in the schema

- Every table has an `mk_id INTEGER UNIQUE` column — this is MemberKit's ID, used as the upsert key.
- Internal `id` (BIGINT auto-increment) is the FK used between tables — never the mk_id.
- `lesson_progress` has a `UNIQUE (user_id, lesson_id)` constraint — upsert is safe.
- `webhook_logs` stores every webhook with status `received → processed | failed` for auditability and retry support.

### Views

| View | Purpose |
|---|---|
| `vw_student_course_progress` | Progress % per student per course |
| `vw_student_section_progress` | Progress % per student per section/module |
| `vw_inactive_students` | Students with active subscriptions but no login in 7+ days |
| `vw_subscription_summary` | Dashboard: count of active/pending/expired per plan |

### Functions

| Function | Purpose |
|---|---|
| `fn_student_full_progress(user_id)` | Returns full nested JSON: courses → sections → lessons with completion state |
| `fn_resolve_mk_id(table, mk_id)` | Translates a MemberKit ID to the internal `id` |
| `trigger_set_updated_at()` | Auto-updates `updated_at` on every UPDATE |

---

## MemberKit API client

File: `src/sync/memberkit-api.client.ts`

The client uses Node.js native `fetch` (Node 18+). Authentication is via `?api_key=` query parameter.

| Method | MK endpoint | Returns |
|---|---|---|
| `getCourses()` | `GET /courses` | Full catalog (sections + lessons nested) |
| `getClassrooms()` | `GET /member_areas` | All classrooms |
| `getPlans()` | `GET /plans` | Plans with their linked classrooms |
| `getMembers(page, perPage)` | `GET /members` | Paginated members |
| `getSubscriptions(page, perPage)` | `GET /subscriptions` | Paginated subscriptions |
| `getEnrollments(page, perPage)` | `GET /enrollments` | Paginated enrollments |

**The `MK*` interfaces are best-guess shapes.** If MemberKit's actual API returns different field names, only the interfaces and mappers in this file need to change — nothing else.

### Pagination

`src/shared/pagination.ts` exposes `fetchAllPages()`. It loops through every page of a paginated endpoint and accumulates all results into a single array. Used by sync orchestrator for members, subscriptions, and enrollments.

---

## Webhook events handled

| MK event | Handler action |
|---|---|
| `member.created` / `member.updated` | upsert user |
| `subscription.created` / `subscription.updated` / `subscription.expired` | upsert membership (resolves user + plan by mk_id) |
| `enrollment.created` / `enrollment.updated` | upsert enrollment |
| `lesson_status_saved` | upsert lesson_progress + insert user_activity |
| `comment.created` | (not yet handled — falls through to "unhandled" log) |

### Signature validation

Configured via `WEBHOOK_SECRET` in `.env`. If set, the handler validates `X-MemberKit-Signature` or `X-Hub-Signature-256` using HMAC-SHA256. If `WEBHOOK_SECRET` is empty, validation is skipped (useful for local testing).

---

## Fields intentionally excluded

The following fields exist in MemberKit's API but are **not stored** in this database because they provide no student tracking value and waste storage:

| Field | Table | Reason excluded |
|---|---|---|
| `bio` | users | Descriptive text, not useful for tracking |
| `profile_image_url` | users | Visual only |
| `description` | courses | Content, not analytics |
| `image_url` | courses | Visual only |
| `page_checkout_url` | courses | Marketing link |
| `description` | sections | Content, not analytics |
| `content` | lessons | Can be very large HTML, zero analytics value |
| `thumbnail_url` | lesson_videos | Visual only |
| `byte_size` | lesson_files | File metadata with no tracking use |
| `content_type` | lesson_files | File metadata with no tracking use |

---

## Configuration (`.env`)

```
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # Never the anon key

MEMBERKIT_API_KEY=...
MEMBERKIT_API_URL=https://app.memberkit.com.br/api/v1

WEBHOOK_SECRET=                 # Leave empty to skip signature validation
```

All variables are validated at startup via Zod (`src/config/env.ts`). The process exits immediately with a clear error message if any required variable is missing.

---

## Running the project

### Development (local)

```bash
cd memberkitsync
cp ../.env .env          # or fill in manually
npm install
npm run dev              # starts Fastify server with hot reload
npm run sync             # runs full one-time sync from MemberKit
```

### Docker

```bash
# from root (SupabaseProject/)
docker compose up --build
```

The Dockerfile uses `tsx` to run TypeScript directly (no build step needed in dev). The `src/` directory is mounted as a volume so edits are reflected immediately.

### Available npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts Fastify webhook server (tsx watch) |
| `npm run sync` | Runs full MemberKit → Supabase sync once |
| `npm run build` | Compiles TypeScript to `dist/` |
| `npm start` | Runs compiled `dist/server.js` (production) |

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/webhooks/memberkit` | Receives MemberKit webhook events |
| `GET` | `/api/users` | Lists all students with course progress (uses `vw_student_course_progress`) |
| `GET` | `/api/users/:mkId` | Full profile + nested progress for one student |
| `GET` | `/api/users/inactive` | Students inactive for 7+ days (uses `vw_inactive_students`) |

---

## Tech stack

| Tool | Version | Role |
|---|---|---|
| Node.js | 20 | Runtime |
| TypeScript | 6 | Language (strict mode, nodenext CJS) |
| Fastify | 5 | HTTP server |
| @supabase/supabase-js | 2 | Supabase client (service_role) |
| Zod | 4 | Environment variable validation |
| Pino | 10 | Structured logging |
| tsx | 4 | TypeScript runner for dev/scripts |
| Docker | — | Containerization |

---

## Adding a new entity

1. Create `src/modules/{entity}/{entity}.types.ts` — add `UpsertXInput` interface
2. Create `src/modules/{entity}/{entity}.mapper.ts` — map `MK*` → `UpsertXInput`
3. Create `src/modules/{entity}/{entity}.repository.ts` — upsert by `mk_id`
4. Add the `MK*` shape to `src/sync/memberkit-api.client.ts`
5. Add the DB type to `src/shared/types.ts`
6. Add a migration in `src/database/migrations/` if adding a new table
7. Wire it into `sync.orchestrator.ts` and/or `webhook.handler.ts`

---

## Adding a new webhook event

1. Add the event name to `MKWebhookEventType` in `webhook.types.ts`
2. Add a typed payload interface in `webhook.types.ts`
3. Add a `case` in the `switch` inside `webhook.handler.ts`
4. Implement the handler function (usually calls an existing service)
