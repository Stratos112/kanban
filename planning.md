# Planning & Architecture

## Overview

A polished, real-time collaborative Kanban board built for the Next Play Games SDE internship assessment.

---

## Board layout

```
 Backlog    Ready    In Progress   In Review   Completed  |  Context
┌────────┐ ┌───────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐
│ [task] │ │[task] │ │  [task]   │ │  [task]  │ │  [task]  │ │ [det]   │
│ [task] │ │[task] │ │  [task]   │ │          │ │  [task]  │ │ [?] Q   │
└────────┘ └───────┘ └───────────┘ └──────────┘ └──────────┘ └─────────┘
   ◀──────────────── drag-and-drop ───────────────▶
```

---

## Database schema

See `supabase-schema-dhfdvwmbutpgwngwyeon(1).png` for the live Supabase ERD. The file `schema.sql` is an early draft and does not reflect the current schema (it predates `boards`, `team_invites`, and `board_id` on tasks/labels/task_relationships).

### Current tables

| Table | Purpose |
|---|---|
| `profiles` | One row per auth user. `display_name`, `avatar_color`. |
| `boards` | Named boards. `slug` (URL-safe unique key), `invite_code`. |
| `tasks` | Tasks and context cards (discriminated by `type`). `board_id`, `parent_task_id`, `context_relation_type`, `parent_link_type`. |
| `labels` | Board-scoped tags. `board_id`, `color`. |
| `task_labels` | M2M join: tasks ↔ labels. |
| `task_relationships` | Directed links between tasks. `type` ∈ blocks / blocked_by / parent_of / child_of / waiting_on / completes. |
| `activity_log` | Per-task event history. `actor_id`, `action`, `payload (jsonb)`. |
| `team_invites` | Peer-to-peer team invitations. `inviter_id`, `invitee_id`, `inviter_color`, `status` ∈ pending / accepted / declined. |

### RLS summary

All tables are readable by any authenticated user (including anonymous guests). Writes are scoped to the row owner (`user_id = auth.uid()` or via task ownership for joins).

---

## Context card types

Each task has exactly one **Details** card (required, auto-created). Additional context can be attached:

| Type | Purpose |
|---|---|
| **Details** | Description field + full activity log for the parent task |
| **Question** | An open question linked to the task; has a link type (Blocking / Waiting On) and an answer field |

---

## Activity log actions

| Action | Payload |
|---|---|
| `task_created` | — |
| `title_edited` | `{ from, to }` |
| `status_changed` | `{ from, to }` |
| `priority_changed` | `{ from, to }` |
| `assigned` | `{ name }` |
| `unassigned` | — |
| `due_date_set` | `{ to }` |
| `due_date_cleared` | — |
| `task_completed_cascade` | `{ cascadedTasks, deletedRelationships }` |

---

## Completion cascade

Completing a task triggers `executeCompletion()` in `src/lib/completion.ts`, which:

1. Finds all `blocks` relationships from the completed task
2. Cascades completion to any downstream tasks that have no other incomplete blockers
3. Deletes satisfied `blocks` relationships
4. Logs `task_completed_cascade` activity with full cascade payload

Un-completing (`executeUncompletion`) uses the stored cascade payload to restore relationships and optionally restore cascaded tasks. If blocked tasks completed independently after the cascade, the restore dialog lets the user choose whether to roll those back too.

---

## Task relationships

Relationships are stored as directed pairs (both directions inserted as separate rows):

| Type stored | Display label (from perspective) |
|---|---|
| `blocks` | Blocks |
| `blocked_by` | Blocked by |
| `parent_of` | Parent of |
| `child_of` | Child of |
| `waiting_on` | Waiting on |
| `completes` | Completes |

---

## Teams

Team membership is stored in `team_invites`. An accepted invite makes both users teammates. Teammates remain visible to each other in focus mode regardless of the hide-others toggle. Leaving the team deletes all invite rows for that user (both as inviter and invitee).

---

## Roadmap

| # | Item | Status |
|---|---|---|
| 1 | Multi-board workspace with slug URLs | ✅ Done |
| 2 | Six-column Kanban with drag-and-drop | ✅ Done |
| 3 | Real-time sync via Supabase Realtime | ✅ Done |
| 4 | Task CRUD with inline drawer | ✅ Done |
| 5 | Context cards (Details / Question) | ✅ Done |
| 6 | Activity log | ✅ Done |
| 7 | Labels with color picker | ✅ Done |
| 8 | Assignment + focus mode | ✅ Done |
| 9 | Task relationships (blocks / parent / waiting) | ✅ Done |
| 10 | Completion cascade + restore dialog | ✅ Done |
| 11 | Review panel (timeline + assignee chart) | ✅ Done |
| 12 | Guest auth (anonymous sign-in) | ✅ Done |
| 13 | Google OAuth sign-in linking | ✅ Done |
| 14 | Search bar on board | ✅ Done |
| 15 | Label filter dropdown | ✅ Done |
| 16 | Teams (invite / accept / leave) | ✅ Done |
| 17 | Test coverage | ⚠️ Partial — shells and routing tested; feature logic untested |
| 18 | Deploy to Vercel | ✅ Done (vercel.json wired; CI on `master`) |

---

## Requirements audit

> The assessment PDF (`NP SDE Assessment Challenge.pdf`) could not be parsed programmatically (binary-encoded). This audit is based on the original planning notes and observable feature set.

### Met requirements

| Requirement | Implementation |
|---|---|
| Kanban board with multiple columns | Backlog / Ready / In Progress / In Review / Completed + Context |
| Create, edit, delete tasks | New Task modal, task drawer, delete in drawer |
| Drag tasks between columns | @dnd-kit with position persistence |
| Real-time collaboration | Supabase Realtime `postgres_changes` on `tasks` table; updates propagate instantly |
| Task assignment | Assignee picker in drawer and new-task modal; avatar badge on card |
| Persistent data | Supabase Postgres; anonymous auth ties session to browser |
| Activity / audit log | Per-task log shown in Details card |
| Analytics / review view | Cumulative line chart + assignee bar chart on Review tab |

### Beyond requirements (extras)

| Feature | Notes |
|---|---|
| Multi-board workspace | Home screen lets you create/select named boards; each has a shareable slug URL |
| Task relationships | Six relationship types with bidirectional display; link mode UI |
| Completion cascade | Blocking relationships propagate completion automatically |
| Restore dialog | Un-completing a cascaded task offers selective rollback |
| Context cards | Structured per-task context (Details with description + activity; Questions with blocking type) |
| Teams system | Invite/accept/leave; focus mode respects teammate visibility |
| Google OAuth | Guest session can be upgraded to a named Google account |
| Label filter | Multi-select filter dropdown on board header |
| Search | Live title search on board header |
| Collapsible columns | Each column can be collapsed to save space |
| Priority | Low / Normal / High with visual indicators |
| Due dates | Date picker on tasks; shown on card when set |

### Gaps / known shortfalls

| Gap | Detail |
|---|---|
| Test coverage | Only page-shell and routing tests exist. No tests for drag-and-drop, real-time sync, cascade logic, or the team invite flow. |
| `schema.sql` is outdated | Predates `boards`, `team_invites`, `board_id` on tasks/labels. The PNG is the authoritative reference. |
| Tasks RLS too narrow | Tasks are writable only by their creator (`user_id`). Assignees cannot edit tasks they don't own, which limits true collaboration on shared tasks. |
| No board-level access control | Anyone who knows a board slug can view and create tasks on it. `invite_code` exists in the schema but is unused. |
