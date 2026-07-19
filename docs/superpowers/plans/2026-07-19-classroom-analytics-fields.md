# Classroom Analytics Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture the `master`, `course_name`, `users_count`, `comments_count`, and `average_progress` fields that MemberKit's `/classrooms` endpoint returns but the sync pipeline currently drops, end to end from DB schema through API client, mapper, and repository.

**Architecture:** Add five columns to the existing `classrooms` table via a new migration, extend the `MKClassroom` API-client interface and the `Classroom`/`ClassroomInsert` shared types to match, then thread the new fields through `classroom.types.ts` → `classroom.mapper.ts` → `classroom.repository.ts` as required fields (mirroring how `name`/`trial_period` are already handled), while `createdAt`/`updatedAt` keep the existing conditional-spread pattern. No changes to `sync.orchestrator.ts`, webhooks, or the membership_levels linking logic — this is a pure field-addition to an existing pipeline.

**Tech Stack:** TypeScript (strict, nodenext CJS), Supabase Postgres (SQL migrations), Vitest for tests.

## Global Constraints

- No `any` types — everything explicit and typed end-to-end (project convention, see CLAUDE.md "Module pattern").
- Follow the existing conditional-spread pattern for genuinely optional fields (`createdAt`/`updatedAt`): `...(value !== undefined && { key: value })` — never write `undefined` into an upsert row. Fields required by the MemberKit schema (`master`, `course_name`, `users_count`, `comments_count`, `average_progress`) are set unconditionally, matching how `name`/`trial_period` are already handled.
- Migration file numbering continues sequentially: next is `052_*.sql` (last existing is `051_unmapped_activities_table.sql`).
- No webhook changes — verified there is no `classroom.created`/`classroom.updated` MemberKit webhook event, and no webhook handler writes to `classrooms` (see spec `docs/superpowers/specs/2026-07-19-classroom-analytics-fields-design.md`).
- No change to `sync.orchestrator.ts` call order or to `membership.service.ts` linking logic.
- Test runner: `npm test` (= `vitest run`) from `memberkitsync/`.

---

### Task 1: Database migration — add analytics columns to `classrooms`

**Files:**
- Create: `memberkitsync/src/database/migrations/052_add_classroom_analytics_fields.sql`

**Interfaces:**
- Produces: five new columns on `classrooms` — `master BOOLEAN NOT NULL DEFAULT FALSE`, `course_name TEXT`, `users_count INTEGER NOT NULL DEFAULT 0`, `comments_count INTEGER NOT NULL DEFAULT 0`, `average_progress NUMERIC NOT NULL DEFAULT 0`. Later tasks (TypeScript types, mapper, repository) rely on these exact column names and nullability.

This is a schema-only task — there's no local Postgres to run migrations against in this repo (migrations are applied manually in the Supabase SQL Editor per CLAUDE.md). Verification here is a syntax/self-review read, not an executed test.

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================================
-- Migration 052: Add analytics fields to classrooms
--
-- MemberKit's /classrooms endpoint returns master, course_name, users_count,
-- comments_count, and average_progress, but the sync pipeline previously
-- only captured mk_id, name, and created_at. These fields carry tracking
-- value (not visual/content-only), so they're added here.
-- ============================================================================

ALTER TABLE classrooms
    ADD COLUMN master            BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN course_name       TEXT,
    ADD COLUMN users_count       INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN comments_count    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN average_progress  NUMERIC NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Self-review the SQL**

Read the file back and confirm:
- Column names match exactly: `master`, `course_name`, `users_count`, `comments_count`, `average_progress` (these exact names are consumed by Task 3's `Classroom` interface).
- No trailing comma issues, no `IF NOT EXISTS` needed (migrations in this repo are run once, in order — consistent with `018_fix_lesson_videos_mk_id_unique.sql` and `051_unmapped_activities_table.sql`, neither of which use `IF NOT EXISTS`).

- [ ] **Step 3: Commit**

```bash
cd "/home/matheus/Área de trabalho/GitHub/MKSupabaseMapper"
git add memberkitsync/src/database/migrations/052_add_classroom_analytics_fields.sql
git commit -m "$(cat <<'EOF'
Add migration for classroom analytics fields

Adds master, course_name, users_count, comments_count, and
average_progress columns to classrooms, matching fields already
returned by MemberKit's /classrooms endpoint but not yet captured.
EOF
)"
```

---

### Task 2: Extend `MKClassroom` API-client interface

**Files:**
- Modify: `memberkitsync/src/sync/memberkit-api.client.ts:121-125`

**Interfaces:**
- Consumes: nothing new.
- Produces: `MKClassroom` gains required fields `master: boolean`, `course_name: string`, `users_count: number`, `comments_count: number`, `average_progress: number`, plus optional `updated_at?: string`. Task 4 (`classroom.mapper.ts`) reads these exact field names off `MKClassroomPayload` (which is `MKClassroom` re-exported).

- [ ] **Step 1: Update the interface**

Current (lines 121-125):

```ts
export interface MKClassroom {
  id: number
  name: string
  created_at?: string
}
```

Replace with:

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

`master`/`course_name`/`users_count`/`comments_count`/`average_progress` are required (not `?`), matching the sample payload in the spec where every field except the timestamps is always present — same convention as `MKMembershipLevel.trial_period` (required) elsewhere in this file. Only `created_at`/`updated_at` stay optional, consistent with the original interface.

- [ ] **Step 2: Typecheck**

Run: `cd memberkitsync && npx tsc --noEmit`
Expected: this introduces errors at any call site that constructs an `MKClassroom` literal without the new required fields (e.g. test fixtures) — expected, resolved by Task 4 Step 1's test rewrite. Confirm no other unrelated errors appear.

- [ ] **Step 3: Commit**

```bash
cd "/home/matheus/Área de trabalho/GitHub/MKSupabaseMapper"
git add memberkitsync/src/sync/memberkit-api.client.ts
git commit -m "$(cat <<'EOF'
Extend MKClassroom with analytics fields from MemberKit API

EOF
)"
```

---

### Task 3: Extend `Classroom`/`ClassroomInsert` shared types

**Files:**
- Modify: `memberkitsync/src/shared/types.ts:76-82`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Classroom` gains `master: boolean`, `course_name: string | null`, `users_count: number`, `comments_count: number`, `average_progress: number` — all required (non-optional) keys, matching the `NOT NULL` columns from Task 1 (`course_name`'s value can be `null` since its column has no `NOT NULL`, but the key itself is always present). `ClassroomInsert` (line 247, `Omit<Classroom, 'id' | 'created_at' | 'updated_at'> & {...}`) picks these up automatically since it derives from `Classroom`. Task 5 (`classroom.repository.ts`) writes rows typed as `ClassroomInsert` using these exact field names, unconditionally (no `??` fallback needed — see Task 5).

- [ ] **Step 1: Update the interface**

Current (lines 76-82):

```ts
export interface Classroom {
  id: number
  mk_id: number
  name: string
  created_at: string
  updated_at: string
}
```

Replace with:

```ts
export interface Classroom {
  id: number
  mk_id: number
  name: string
  master: boolean
  course_name: string | null
  users_count: number
  comments_count: number
  average_progress: number
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Verify `ClassroomInsert` picks up the new fields**

Read `memberkitsync/src/shared/types.ts:247` and confirm it still reads:

```ts
export type ClassroomInsert = Omit<Classroom, 'id' | 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }
```

No edit needed here — `Omit<Classroom, ...>` automatically includes the five new required fields (`master`, `course_name`, `users_count`, `comments_count`, `average_progress`) as required on `ClassroomInsert`. This is intentional: it forces Task 5's `upsertClassroom` to supply a concrete value for each of them on every upsert, matching the `NOT NULL` columns from Task 1 (`course_name` stays nullable at the DB level, matching its nullable column, but the TS key itself is still required).

- [ ] **Step 3: Typecheck**

Run: `cd memberkitsync && npx tsc --noEmit`
Expected: this will now show errors in `classroom.repository.ts` (`upsertClassroom`'s `row` object is missing the new required `Classroom` fields) — that's expected and gets fixed in Task 5. Confirm the errors are exactly in `classroom.repository.ts` and nowhere else.

- [ ] **Step 4: Commit**

```bash
cd "/home/matheus/Área de trabalho/GitHub/MKSupabaseMapper"
git add memberkitsync/src/shared/types.ts
git commit -m "$(cat <<'EOF'
Extend Classroom/ClassroomInsert with analytics fields

EOF
)"
```

---

### Task 4: Extend `UpsertClassroomInput` and mapper

**Files:**
- Modify: `memberkitsync/src/modules/classrooms/classroom.types.ts:7-11`
- Modify: `memberkitsync/src/modules/classrooms/classroom.mapper.ts`
- Test: `memberkitsync/src/modules/classrooms/__tests__/classroom.mapper.test.ts`

**Interfaces:**
- Consumes: `MKClassroom` fields from Task 2 (`master`, `course_name`, `users_count`, `comments_count`, `average_progress` required; `created_at?`, `updated_at?` optional).
- Produces: `UpsertClassroomInput` gains `master: boolean`, `courseName: string`, `usersCount: number`, `commentsCount: number`, `averageProgress: number` (required, camelCase) plus `updatedAt?: string` (optional). `mkClassroomToUpsertInput()` maps MK snake_case → these camelCase fields. Task 5 (`classroom.repository.ts`) reads these exact camelCase field names off `UpsertClassroomInput`.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `memberkitsync/src/modules/classrooms/__tests__/classroom.mapper.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { mkClassroomToUpsertInput } from '../classroom.mapper.js'
import type { MKClassroomPayload } from '../classroom.types.js'

describe('mkClassroomToUpsertInput', () => {
  it('maps all fields', () => {
    const mk: MKClassroomPayload = {
      id: 15,
      name: 'Turma ESA 2024',
      master: true,
      course_name: 'Matemática 1 - ESA',
      users_count: 42,
      comments_count: 7,
      average_progress: 63.5,
      created_at: '2023-11-07T05:31:56Z',
      updated_at: '2023-11-08T05:31:56Z',
    }

    expect(mkClassroomToUpsertInput(mk)).toEqual({
      mkId: 15,
      name: 'Turma ESA 2024',
      master: true,
      courseName: 'Matemática 1 - ESA',
      usersCount: 42,
      commentsCount: 7,
      averageProgress: 63.5,
      createdAt: '2023-11-07T05:31:56Z',
      updatedAt: '2023-11-08T05:31:56Z',
    })
  })

  it('maps required fields without timestamps when they are absent', () => {
    const mk: MKClassroomPayload = {
      id: 1,
      name: 'X',
      master: false,
      course_name: 'Curso Y',
      users_count: 0,
      comments_count: 0,
      average_progress: 0,
    }
    const result = mkClassroomToUpsertInput(mk)

    expect(result).toEqual({
      mkId: 1,
      name: 'X',
      master: false,
      courseName: 'Curso Y',
      usersCount: 0,
      commentsCount: 0,
      averageProgress: 0,
    })
    expect(Object.keys(result)).not.toContain('createdAt')
    expect(Object.keys(result)).not.toContain('updatedAt')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd memberkitsync && npx vitest run src/modules/classrooms/__tests__/classroom.mapper.test.ts`
Expected: FAIL — `mkClassroomToUpsertInput` doesn't map `master`/`courseName`/`usersCount`/`commentsCount`/`averageProgress`/`updatedAt` yet, and `MKClassroomPayload` literals in the test don't yet accept those fields (Task 2 already made them required on `MKClassroom`, but the mapper hasn't caught up) — expect either a type error surfaced as a test run failure or an assertion mismatch depending on how strict the vitest/tsc integration is; either way this must fail before Step 4.

- [ ] **Step 3: Extend `UpsertClassroomInput`**

Current `memberkitsync/src/modules/classrooms/classroom.types.ts` (lines 7-11):

```ts
export interface UpsertClassroomInput {
  mkId: number
  name: string
  createdAt?: string
}
```

Replace with:

```ts
export interface UpsertClassroomInput {
  mkId: number
  name: string
  master: boolean
  courseName: string
  usersCount: number
  commentsCount: number
  averageProgress: number
  createdAt?: string
  updatedAt?: string
}
```

- [ ] **Step 4: Update the mapper**

Replace the full contents of `memberkitsync/src/modules/classrooms/classroom.mapper.ts` with:

```ts
import type { MKClassroomPayload, UpsertClassroomInput } from './classroom.types.js'

export function mkClassroomToUpsertInput(mk: MKClassroomPayload): UpsertClassroomInput {
  return {
    mkId: mk.id,
    name: mk.name,
    master: mk.master,
    courseName: mk.course_name,
    usersCount: mk.users_count,
    commentsCount: mk.comments_count,
    averageProgress: mk.average_progress,
    ...(mk.created_at !== undefined && { createdAt: mk.created_at }),
    ...(mk.updated_at !== undefined && { updatedAt: mk.updated_at }),
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd memberkitsync && npx vitest run src/modules/classrooms/__tests__/classroom.mapper.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
cd "/home/matheus/Área de trabalho/GitHub/MKSupabaseMapper"
git add memberkitsync/src/modules/classrooms/classroom.types.ts memberkitsync/src/modules/classrooms/classroom.mapper.ts memberkitsync/src/modules/classrooms/__tests__/classroom.mapper.test.ts
git commit -m "$(cat <<'EOF'
Map classroom analytics fields in mkClassroomToUpsertInput

EOF
)"
```

---

### Task 5: Update `upsertClassroom` repository

**Files:**
- Modify: `memberkitsync/src/modules/classrooms/classroom.repository.ts:5-20`

**Interfaces:**
- Consumes: `UpsertClassroomInput` fields from Task 4 (`master`, `courseName`, `usersCount`, `commentsCount`, `averageProgress` required; `updatedAt?` optional); `ClassroomInsert` type from Task 3.
- Produces: `upsertClassroom()` writes the five new columns to Supabase. No signature change — still `(input: UpsertClassroomInput) => Promise<Classroom>`.

This repository talks to live Supabase and has no existing unit test (it's exercised via the mapper tests + integration in practice, consistent with the rest of the `classrooms` module — there is no `classroom.repository.test.ts` in the repo today). Verification is via typecheck, matching how this module is currently tested.

- [ ] **Step 1: Update `upsertClassroom`**

Current (lines 5-20):

```ts
export async function upsertClassroom(input: UpsertClassroomInput): Promise<Classroom> {
  const row: ClassroomInsert = {
    mk_id: input.mkId,
    name: input.name,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
  }

  const { data, error } = await supabase
    .from('classrooms')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert classroom mk_id=${input.mkId}`, error)
  return data as Classroom
}
```

Replace with:

```ts
export async function upsertClassroom(input: UpsertClassroomInput): Promise<Classroom> {
  const row: ClassroomInsert = {
    mk_id: input.mkId,
    name: input.name,
    master: input.master,
    course_name: input.courseName,
    users_count: input.usersCount,
    comments_count: input.commentsCount,
    average_progress: input.averageProgress,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
    ...(input.updatedAt !== undefined && { updated_at: input.updatedAt }),
  }

  const { data, error } = await supabase
    .from('classrooms')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert classroom mk_id=${input.mkId}`, error)
  return data as Classroom
}
```

`master`/`courseName`/`usersCount`/`commentsCount`/`averageProgress` are written unconditionally (no `??` fallback, no conditional spread) — same treatment as `name` above them. This matches the required typing threaded through from Task 2 (`MKClassroom`) and mirrors how `MembershipLevel.trial_period` is handled elsewhere in the codebase. Only `createdAt`/`updatedAt` stay conditionally spread, since those are genuinely optional metadata that shouldn't overwrite existing DB timestamps when absent.

- [ ] **Step 2: Typecheck**

Run: `cd memberkitsync && npx tsc --noEmit`
Expected: no errors (the errors introduced in Task 3 Step 3 are now resolved).

- [ ] **Step 3: Run full test suite**

Run: `cd memberkitsync && npm test`
Expected: PASS — all existing tests plus the new `classroom.mapper.test.ts` cases pass, no regressions in `membership.mapper.test.ts` or elsewhere.

- [ ] **Step 4: Commit**

```bash
cd "/home/matheus/Área de trabalho/GitHub/MKSupabaseMapper"
git add memberkitsync/src/modules/classrooms/classroom.repository.ts
git commit -m "$(cat <<'EOF'
Persist classroom analytics fields in upsertClassroom

EOF
)"
```

---

## Post-plan verification

- [ ] Run `cd memberkitsync && npx tsc --noEmit && npm test` once more end to end — confirm zero errors, all tests green.
- [ ] Manually re-read `docs/superpowers/specs/2026-07-19-classroom-analytics-fields-design.md` against the final diff — confirm all five fields (`master`, `course_name`, `users_count`, `comments_count`, `average_progress`) are present in: migration, `MKClassroom`, `Classroom`, `UpsertClassroomInput`, mapper, repository.
- [ ] Remind the user the migration (`052_add_classroom_analytics_fields.sql`) still needs to be run manually in the Supabase SQL Editor before the next `npm run sync` — code changes alone don't touch the live DB.
