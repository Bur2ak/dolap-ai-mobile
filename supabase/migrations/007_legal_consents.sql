alter table profiles
  add column if not exists kvkk_consent_at timestamptz,
  add column if not exists terms_accepted_at timestamptz;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, kvkk_consent_at, terms_accepted_at)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    nullif(new.raw_user_meta_data->>'kvkk_consent_at', '')::timestamptz,
    nullif(new.raw_user_meta_data->>'terms_accepted_at', '')::timestamptz
  );
  return new;
end;
$$ language plpgsql security definer;
