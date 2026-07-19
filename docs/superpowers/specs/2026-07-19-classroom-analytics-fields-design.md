# Classroom analytics fields — design

## Context

The `classrooms` → `membership_levels` → `membership_level_classrooms` sync
pipeline already exists and works: `classroom.repository.ts`,
`membership.repository.ts`, `membership.service.ts` upsert both entities and
`syncPlan()` links each `membership_level` to its classrooms via
`classroom_ids`. `sync.orchestrator.ts` already runs `syncClassrooms()` then
`syncPlans()` in the correct FK order.

What's missing: the MemberKit `/classrooms` endpoint returns additional
fields that the current mapper/table silently drop:

```json
[
  {
    "id": 123,
    "name": "<string>",
    "master": true,
    "course_name": "<string>",
    "users_count": 123,
    "comments_count": 123,
    "average_progress": 123,
    "created_at": "2023-11-07T05:31:56Z",
    "updated_at": "2023-11-07T05:31:56Z"
  }
]
```

Today only `mk_id`, `name`, and `created_at` are captured. None of the new
fields are visual/content-only (the project's stated exclusion criterion —
see "Fields intentionally excluded" in CLAUDE.md), so all five carry
tracking value and should be persisted.

## Goal

Capture `master`, `course_name`, `users_count`, `comments_count`, and
`average_progress` on the `classrooms` table, end to end from the MemberKit
API client through to the repository upsert. No change to the
membership_levels ↔ classrooms linking logic, which already works.

## Non-goals

- No webhook changes. Verified in `webhook.types.ts` (lines 62, 82, 123) and
  `webhook.handler.ts` (line 255): `classroom_id` appears only as an FK
  resolved via `getClassroomByMkId()` for `enrollment.*` /
  `membership.*` events. There is no `classroom.created` /
  `classroom.updated` event type, and no webhook handler writes to
  `classrooms`. All writes to `classrooms` — including the five new
  fields — come exclusively from `syncClassrooms()` in the full sync.
- No change to `sync.orchestrator.ts` call order.
- No change to `membership_levels` or `membership_level_classrooms` schema
  or logic.

## Design

### 1. Migration `052_add_classroom_analytics_fields.sql`

Adds to `classrooms`:

| Column | Type | Default |
|---|---|---|
| `master` | `BOOLEAN NOT NULL` | `FALSE` |
| `course_name` | `TEXT` | (nullable) |
| `users_count` | `INTEGER NOT NULL` | `0` |
| `comments_count` | `INTEGER NOT NULL` | `0` |
| `average_progress` | `NUMERIC NOT NULL` | `0` |

`average_progress` is `NUMERIC` (not `INTEGER`) to tolerate decimal
percentages even though the sample payload shows an integer.

### 2. `src/sync/memberkit-api.client.ts`

Extend `MKClassroom`:

```ts
export interface MKClassroom {
  id: number
  name: string
  master: boolean
  course_name: string
  users_count: number
  comments_count: number
  average_progress: number
  created_at?: string
  updated_at?: string
}
```

The five new fields are required (not `?`), matching the sample payload
where every field except the timestamps is always present — same
convention as `MKMembershipLevel.trial_period` (required) elsewhere in this
file. Only `created_at`/`updated_at` stay optional.

### 3. `src/shared/types.ts`

Extend `Classroom` with the five new fields as required keys (matching DB
column names/types; `course_name`'s value can be `null` since its column
has no `NOT NULL`, but the key itself is always present).
`ClassroomInsert` is derived via `Omit<...>` so it picks up the new fields
automatically.

### 4. `src/modules/classrooms/classroom.types.ts`

Extend `UpsertClassroomInput` with required camelCase equivalents:
`master`, `courseName`, `usersCount`, `commentsCount`, `averageProgress`.

### 5. `src/modules/classrooms/classroom.mapper.ts`

`mkClassroomToUpsertInput` maps the five new fields unconditionally
(they're required end to end). `createdAt`/`updatedAt` keep the existing
conditional-spread pattern.

### 6. `src/modules/classrooms/classroom.repository.ts`

`upsertClassroom` includes the five new columns unconditionally in the row
passed to `.upsert()`, same treatment as `name`. `created_at`/`updated_at`
keep the conditional spread.

### 7. Tests

Update `classroom.mapper.test.ts` to cover full-field mapping (all five new
required fields present, plus timestamps) and confirm the required fields
still map correctly when the optional timestamps are absent.

## Risks / edge cases

- `users_count`, `comments_count`, `average_progress` are snapshot counts at
  sync time; they go stale between syncs. Acceptable since there's no
  webhook source for classroom updates — full sync is already the only way
  these refresh, and every sync run overwrites them with the latest
  MemberKit values (required fields, written unconditionally).
