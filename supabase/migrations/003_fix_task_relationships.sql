-- Remove the inline type CHECK so the app can use its full set of link types:
-- blocks, blocked_by, parent_of, child_of, waiting_on, completes
alter table task_relationships
  drop constraint if exists task_relationships_type_check;

-- The original RLS policy only allowed insert when the caller owns the FROM task.
-- That meant the inverse row (from_task_id = target, which the caller may not own)
-- was always rejected.  Allow insert when the caller owns EITHER endpoint.
drop policy if exists "task_relationships: write via task ownership" on task_relationships;

create policy "task_relationships: write via task ownership"
  on task_relationships for insert with check (
    auth.uid() is not null
    and (
      exists (select 1 from tasks where id = from_task_id and user_id = auth.uid())
      or
      exists (select 1 from tasks where id = to_task_id   and user_id = auth.uid())
    )
  );
