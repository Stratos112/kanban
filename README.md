# Kanban Task Board

A polished, fully-featured Kanban board built for the Next Play Games SDE internship assessment.

## Stack

- **React + TypeScript** — UI and type safety
- **Vite** — dev server and build tooling
- **CSS Modules** — component-scoped plain CSS, no utility framework
- **@dnd-kit/core** — accessible drag-and-drop
- **Supabase** — Postgres database, anonymous auth, Row Level Security
- **Vercel** — hosting and CI/CD from GitHub

## Features

- Kanban board with To Do / In Progress / In Review / Done columns
- Drag-and-drop task reordering within and across columns
- Guest accounts via Supabase anonymous auth (no sign-up required)
- Create tasks with title, description, priority, and due date
- Due date indicators (overdue / due soon highlighted on card)
- Labels / tags with color, assignable to tasks, filterable
- Task comments with timestamps
- Task activity log (status changes, edits, assignments)
- Team members with avatar colors, assignable to tasks
- Board summary stats (total, completed, overdue)
- Search and filter by title, priority, assignee, label

## Local Development

```bash
npm install
npm run dev
```

Requires a `.env` file with:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Database Schema

See `schema.sql` for the full Supabase schema including RLS policies.
