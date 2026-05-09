create table if not exists usage_counters (
  user_id uuid not null references profiles(id) on delete cascade,
  metric text not null check (metric in ('daily_outfit_suggestions', 'monthly_buy_decisions')),
  period_key text not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, metric, period_key)
);

alter table usage_counters enable row level security;

drop policy if exists "Users can read own usage counters" on usage_counters;
create policy "Users can read own usage counters"
  on usage_counters for select using (auth.uid() = user_id);

drop policy if exists "Users can manage own usage counters" on usage_counters;
create policy "Users can manage own usage counters"
  on usage_counters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function get_usage_count(input_metric text, input_period_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  usage_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if input_metric not in ('daily_outfit_suggestions', 'monthly_buy_decisions') then
    raise exception 'Invalid usage metric';
  end if;

  select count into usage_count
  from usage_counters
  where user_id = current_user_id
    and metric = input_metric
    and period_key = input_period_key;

  return coalesce(usage_count, 0);
end;
$$;

create or replace function increment_usage_counter(input_metric text, input_period_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  next_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if input_metric not in ('daily_outfit_suggestions', 'monthly_buy_decisions') then
    raise exception 'Invalid usage metric';
  end if;

  insert into usage_counters (user_id, metric, period_key, count, updated_at)
  values (current_user_id, input_metric, input_period_key, 1, now())
  on conflict (user_id, metric, period_key)
  do update set count = usage_counters.count + 1, updated_at = now()
  returning count into next_count;

  return next_count;
end;
$$;

grant execute on function get_usage_count(text, text) to authenticated;
grant execute on function increment_usage_counter(text, text) to authenticated;
