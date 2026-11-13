# Kanban Task Board

A real-time collaborative Kanban board built with React, Supabase, and Vite for the Next Play Games SDE internship assessment.

## Stack

| | |
|---|---|
| **React 19 + TypeScript** | UI and type safety |
| **Vite 6** | Dev server and build tooling |
| **CSS Modules** | Component-scoped plain CSS |
| **@dnd-kit** | Accessible drag-and-drop |
| **Recharts** | Charts for the Review view |
| **Supabase** | Postgres, anonymous auth, Realtime, RLS |
| **Vercel** | Hosting and CI/CD |
| **Vitest + Testing Library** | Unit and component tests |

## Features

**Board**
- **Multi-board workspace** — create boards from the home screen; each has a unique shareable URL slug
- **Six-column Kanban** — Backlog → Ready → In Progress → In Review → Completed, plus a pinned Context column
- **Drag-and-drop** — move tasks between columns or reorder within a column; positions persist to Supabase
- **Real-time sync** — all task changes appear instantly across open sessions via Supabase Realtime
- **Collapsible columns** — click any column header to collapse it; state is local per session
- **Search** — live title filter in the board header
- **Label filter** — multi-select label dropdown to narrow the board view

**Tasks**
- **Task drawer** — click any task to open an inline panel; edit title, status, priority, due date, assignee, and labels
- **Context cards** — per-task context objects: a required Details card (description + activity log) plus optional Questions
- **Activity log** — status changes, priority changes, assignments, and edits logged per task with timestamps
- **Labels** — board-scoped label palette managed in Settings; assignable per task with color coding
- **Task relationships** — link tasks as Blocks / Blocked By / Parent Of / Child Of / Waiting On / Completes
- **Completion cascade** — completing a task propagates completion to tasks it blocks; cascaded tasks animate out
- **Restore dialog** — un-completing a cascaded task prompts to optionally restore linked tasks

**Users & identity**
- **Guest auth** — silent anonymous sign-in on first load; identity persists across page refreshes
- **Google Sign-in** — link a Google account to your guest session for cross-device persistence
- **Avatar color** — each user picks a personal color displayed on task assignee badges
- **Focus mode** — toggle in the board header or Profile page; hides tasks assigned to other users (teammates stay visible)
- **Teams** — invite other board members to your team; accepted teammates stay visible in focus mode; leave team at any time

**Review**
- **Activity timeline** — cumulative line chart (Created / In Progress / Completed) with a dynamic granularity slider
- **Work-by-assignee** — bar chart of open vs. completed tasks per user
- **Summary strip** — total created, total completed, project duration

## Database schema

![Database schema](<supabase-schema-dhfdvwmbutpgwngwyeon(1).png>)

Tables: `profiles`, `boards`, `tasks`, `labels`, `task_labels`, `task_relationships`, `activity_log`, `team_invites`

All tables use Supabase RLS. All authenticated users (including anonymous guests) can read; writes are scoped to row ownership.

## Run locally

```bash
npm install
npm run dev
```

Requires a `.env` file:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Build & test

```bash
npm run build   # tsc + vite build
npm run test    # vitest
```

See [planning.md](planning.md) for architecture notes and requirements audit.
