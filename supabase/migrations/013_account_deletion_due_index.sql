create index if not exists idx_profiles_due_deletions
  on public.profiles(deletion_scheduled_for)
  where deletion_requested_at is not null;
