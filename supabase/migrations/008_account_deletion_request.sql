alter table profiles
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for date;
