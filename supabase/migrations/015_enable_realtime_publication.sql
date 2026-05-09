do $$
declare
  table_name text;
  realtime_tables text[] := array[
    'wardrobe_items',
    'outfits',
    'outfit_items',
    'outfit_votes',
    'friendships',
    'loan_requests',
    'notifications',
    'referral_rewards'
  ];
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    return;
  end if;

  foreach table_name in array realtime_tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
