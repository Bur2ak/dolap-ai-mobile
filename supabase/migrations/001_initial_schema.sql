create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  bio text,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'premium', 'family')),
  subscription_expires_at timestamptz,
  push_token text,
  notification_preferences jsonb default '{
    "outfit_reminder": true,
    "price_drops": true,
    "friend_requests": true,
    "outfit_votes": true
  }'::jsonb,
  privacy_settings jsonb default '{
    "wardrobe_visible": false,
    "allow_friend_requests": true
  }'::jsonb,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists wardrobe_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  image_url text not null,
  thumbnail_url text,
  category text not null,
  subcategory text,
  colors jsonb default '[]'::jsonb,
  dominant_color_hex text,
  season text[] default '{}',
  brand text,
  purchase_price numeric(10, 2),
  wear_count integer default 0,
  last_worn date,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_wardrobe_items_user_id on wardrobe_items(user_id);
create index if not exists idx_wardrobe_items_active on wardrobe_items(user_id, is_active);

create table if not exists outfits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text,
  event_type text,
  weather_temp integer,
  weather_description text,
  mood text,
  ai_reasoning text,
  worn_at date,
  is_favorite boolean default false,
  created_at timestamptz default now()
);

create table if not exists outfit_items (
  outfit_id uuid not null references outfits(id) on delete cascade,
  item_id uuid not null references wardrobe_items(id) on delete cascade,
  position integer,
  primary key (outfit_id, item_id)
);

create index if not exists idx_outfits_user_id on outfits(user_id);

create table if not exists buy_decisions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_image_url text,
  product_name text,
  price numeric(10, 2),
  decision text check (decision in ('AL', 'BEKLEME', 'ALMA')),
  confidence numeric(3, 2),
  similar_items jsonb default '[]'::jsonb,
  combination_count integer,
  ai_reasoning text,
  created_at timestamptz default now()
);

create index if not exists idx_buy_decisions_user_id on buy_decisions(user_id);

create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  outfit_id uuid references outfits(id) on delete set null,
  title text not null,
  event_type text not null,
  event_date timestamptz not null,
  location text,
  notes text,
  calendar_event_id text,
  created_at timestamptz default now()
);

create index if not exists idx_events_user_id on events(user_id);

create table if not exists price_tracking (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_name text not null,
  product_url text,
  product_image_url text,
  current_price numeric(10, 2),
  target_price numeric(10, 2),
  initial_price numeric(10, 2),
  price_history jsonb default '[]'::jsonb,
  store text,
  is_active boolean default true,
  last_checked timestamptz,
  notified_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_price_tracking_user_id on price_tracking(user_id);

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('friend_request', 'outfit_vote', 'price_drop', 'outfit_reminder', 'lend_request', 'system')),
  title text not null,
  body text,
  data jsonb default '{}'::jsonb,
  is_read boolean default false,
  sent_at timestamptz default now()
);

create index if not exists idx_notifications_user_id on notifications(user_id, is_read);

create table if not exists friendships (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(requester_id, addressee_id),
  check (requester_id != addressee_id)
);

create index if not exists idx_friendships_requester on friendships(requester_id);
create index if not exists idx_friendships_addressee on friendships(addressee_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table profiles enable row level security;
alter table wardrobe_items enable row level security;
alter table outfits enable row level security;
alter table outfit_items enable row level security;
alter table buy_decisions enable row level security;
alter table events enable row level security;
alter table price_tracking enable row level security;
alter table notifications enable row level security;
alter table friendships enable row level security;

create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can manage own wardrobe"
  on wardrobe_items for all using (auth.uid() = user_id);

create policy "Users can manage own outfits"
  on outfits for all using (auth.uid() = user_id);

create policy "Users can manage own outfit items"
  on outfit_items for all using (
    exists (
      select 1 from outfits
      where outfits.id = outfit_items.outfit_id
      and outfits.user_id = auth.uid()
    )
  );

create policy "Users can manage own buy decisions"
  on buy_decisions for all using (auth.uid() = user_id);

create policy "Users can manage own events"
  on events for all using (auth.uid() = user_id);

create policy "Users can manage own price tracking"
  on price_tracking for all using (auth.uid() = user_id);

create policy "Users can manage own notifications"
  on notifications for all using (auth.uid() = user_id);

create policy "Users can read own friendships"
  on friendships for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send friend requests"
  on friendships for insert with check (auth.uid() = requester_id);

create policy "Users can update own friendships"
  on friendships for update using (auth.uid() = requester_id or auth.uid() = addressee_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wardrobe-images',
  'wardrobe-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Users can upload own wardrobe images" on storage.objects;
create policy "Users can upload own wardrobe images"
  on storage.objects for insert with check (
    bucket_id = 'wardrobe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Public wardrobe images are readable" on storage.objects;
create policy "Public wardrobe images are readable"
  on storage.objects for select using (bucket_id = 'wardrobe-images');

drop policy if exists "Users can delete own wardrobe images" on storage.objects;
create policy "Users can delete own wardrobe images"
  on storage.objects for delete using (
    bucket_id = 'wardrobe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
