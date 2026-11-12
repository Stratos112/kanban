# Kanban Task Board

A real-time collaborative Kanban board built with React, Supabase, and Vite.

## Stack

| | |
|---|---|
| **React 19 + TypeScript** | UI and type safety |
| **Vite 8** | Dev server and build tooling |
| **CSS Modules** | Component-scoped plain CSS |
| **@dnd-kit** | Accessible drag-and-drop |
| **Recharts** | Charts for the Review view |
| **Supabase** | Postgres, anonymous auth, Realtime, RLS |
| **Vercel** | Hosting and CI/CD |

## Features

- **Multi-board workspace** — create boards, each with a unique shareable URL
- **Six-column Kanban** — Backlog → Ready → In Progress → In Review → Completed, plus a pinned Context column
- **Drag-and-drop** — move tasks between columns or reorder within a column; positions persist
- **Real-time sync** — all changes appear instantly across open sessions via Supabase Realtime
- **Task drawer** — inline editing of title, status, priority, due date, assignee, and labels
- **Context cards** — per-task context objects: a required Details card (description + activity log), plus optional Questions and Comments
- **Activity log** — status changes, assignments, and edits logged per task; visible in the Details card
- **Labels** — board-scoped label palette with a color picker; assignable per task
- **Guest auth** — silent anonymous sign-in on first load; persistent identity via localStorage
- **Focus mode** — board defaults to showing only your assigned tasks; toggle in the header to see all
- **Completion cascade** — completing a task propagates completion to tasks it blocks
- **Review tab** — cumulative activity chart (Created / In Progress / Completed) with a dynamic timescale slider, and a work-by-assignee breakdown

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

## Build

```bash
npm run build   # tsc + vite build
npm run test    # vitest
```

See [planning.md](planning.md) for architecture notes, database schema, and roadmap.
