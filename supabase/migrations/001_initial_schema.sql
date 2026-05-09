create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  bio text,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'premium', 'family')),
  subscription_expires_at timestamptz,
  revenuecat_customer_id text,
  push_token text,
  notification_preferences jsonb default '{
    "outfit_reminder": true,
    "price_drops": true,
    "friend_requests": true,
    "outfit_votes": true,
    "lend_requests": true
  }'::jsonb,
  privacy_settings jsonb default '{
    "wardrobe_visible": false,
    "allow_friend_requests": true
  }'::jsonb,
  onboarding_completed boolean default false,
  kvkk_consent_at timestamptz,
  terms_accepted_at timestamptz,
  deletion_requested_at timestamptz,
  deletion_scheduled_for date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_due_deletions
  on profiles(deletion_scheduled_for)
  where deletion_requested_at is not null;

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
  is_shareable boolean default false,
  is_lendable boolean default false,
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
  is_shareable boolean default false,
  share_token text unique,
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

create table if not exists outfit_votes (
  id uuid primary key default uuid_generate_v4(),
  outfit_id uuid not null references outfits(id) on delete cascade,
  voter_id uuid not null references profiles(id) on delete cascade,
  vote text not null check (vote in ('yes', 'no', 'love')),
  created_at timestamptz default now(),
  unique(outfit_id, voter_id)
);

create index if not exists idx_outfit_votes_outfit_id on outfit_votes(outfit_id);

create table if not exists loan_requests (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references wardrobe_items(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  requester_id uuid not null references profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'approved', 'declined', 'returned')),
  requested_at timestamptz default now(),
  due_date date,
  returned_at timestamptz,
  note text,
  check (owner_id != requester_id)
);

create index if not exists idx_loan_requests_owner on loan_requests(owner_id, status);
create index if not exists idx_loan_requests_requester on loan_requests(requester_id, status);
create unique index if not exists idx_loan_requests_active_unique on loan_requests(item_id, requester_id) where status in ('pending', 'approved');

create table if not exists referral_rewards (
  id uuid primary key default uuid_generate_v4(),
  friendship_id uuid not null unique references friendships(id) on delete cascade,
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_id uuid not null references profiles(id) on delete cascade,
  reward_days integer not null default 30,
  created_at timestamptz default now(),
  check (referrer_id != referred_id)
);

create index if not exists idx_referral_rewards_referrer on referral_rewards(referrer_id);
create index if not exists idx_referral_rewards_referred on referral_rewards(referred_id);

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on profiles;
create trigger set_profiles_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_wardrobe_items_updated_at on wardrobe_items;
create trigger set_wardrobe_items_updated_at
  before update on wardrobe_items
  for each row execute function public.set_updated_at();

drop trigger if exists set_friendships_updated_at on friendships;
create trigger set_friendships_updated_at
  before update on friendships
  for each row execute function public.set_updated_at();

create or replace function public.claim_friend_referral_reward(p_friendship_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  friendship_row friendships%rowtype;
  reward_exists boolean;
  referrer_current_expiry timestamptz;
  referred_current_expiry timestamptz;
  reward_days integer := 30;
begin
  select * into friendship_row
  from friendships
  where id = p_friendship_id
  and status = 'accepted'
  and (
    requester_id = auth.uid()
    or addressee_id = auth.uid()
  );

  if not found then
    return false;
  end if;

  select exists (
    select 1 from referral_rewards where friendship_id = p_friendship_id
  ) into reward_exists;

  if reward_exists then
    return false;
  end if;

  insert into referral_rewards (friendship_id, referrer_id, referred_id, reward_days)
  values (p_friendship_id, friendship_row.requester_id, friendship_row.addressee_id, reward_days);

  select greatest(coalesce(subscription_expires_at, now()), now())
  into referrer_current_expiry
  from profiles
  where id = friendship_row.requester_id;

  select greatest(coalesce(subscription_expires_at, now()), now())
  into referred_current_expiry
  from profiles
  where id = friendship_row.addressee_id;

  update profiles
  set
    subscription_tier = 'premium',
    subscription_expires_at = referrer_current_expiry + make_interval(days => reward_days),
    updated_at = now()
  where id = friendship_row.requester_id;

  update profiles
  set
    subscription_tier = 'premium',
    subscription_expires_at = referred_current_expiry + make_interval(days => reward_days),
    updated_at = now()
  where id = friendship_row.addressee_id;

  return true;
end;
$$;

alter table profiles enable row level security;
alter table wardrobe_items enable row level security;
alter table outfits enable row level security;
alter table outfit_items enable row level security;
alter table buy_decisions enable row level security;
alter table events enable row level security;
alter table price_tracking enable row level security;
alter table notifications enable row level security;
alter table friendships enable row level security;
alter table outfit_votes enable row level security;
alter table loan_requests enable row level security;
alter table referral_rewards enable row level security;

create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can read social profiles"
  on profiles for select using (
    auth.uid() is not null
    and (
      coalesce((privacy_settings->>'allow_friend_requests')::boolean, true)
      or exists (
        select 1 from friendships
        where friendships.status = 'accepted'
        and (
          (friendships.requester_id = auth.uid() and friendships.addressee_id = profiles.id)
          or (friendships.addressee_id = auth.uid() and friendships.requester_id = profiles.id)
        )
      )
    )
  );

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can manage own wardrobe"
  on wardrobe_items for all using (auth.uid() = user_id);

create policy "Accepted friends can read shared wardrobe"
  on wardrobe_items for select using (
    is_active = true
    and is_shareable = true
    and exists (
      select 1 from profiles
      where profiles.id = wardrobe_items.user_id
      and coalesce((profiles.privacy_settings->>'wardrobe_visible')::boolean, false)
    )
    and exists (
      select 1 from friendships
      where friendships.status = 'accepted'
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = wardrobe_items.user_id)
        or (friendships.addressee_id = auth.uid() and friendships.requester_id = wardrobe_items.user_id)
      )
    )
  );

create policy "Accepted friends can read shared outfit wardrobe"
  on wardrobe_items for select using (
    is_active = true
    and exists (
      select 1 from outfit_items
      join outfits on outfits.id = outfit_items.outfit_id
      join friendships on friendships.status = 'accepted'
      where outfit_items.item_id = wardrobe_items.id
      and outfits.is_shareable = true
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = outfits.user_id)
        or (friendships.addressee_id = auth.uid() and friendships.requester_id = outfits.user_id)
      )
    )
  );

create policy "Public can read token shared outfit wardrobe"
  on wardrobe_items for select using (
    is_active = true
    and exists (
      select 1 from outfit_items
      join outfits on outfits.id = outfit_items.outfit_id
      where outfit_items.item_id = wardrobe_items.id
      and outfits.is_shareable = true
      and outfits.share_token is not null
    )
  );

create policy "Users can manage own outfits"
  on outfits for all using (auth.uid() = user_id);

create policy "Accepted friends can read shared outfits"
  on outfits for select using (
    is_shareable = true
    and exists (
      select 1 from friendships
      where friendships.status = 'accepted'
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = outfits.user_id)
        or (friendships.addressee_id = auth.uid() and friendships.requester_id = outfits.user_id)
      )
    )
  );

create policy "Public can read token shared outfits"
  on outfits for select using (
    is_shareable = true
    and share_token is not null
  );

create policy "Users can manage own outfit items"
  on outfit_items for all using (
    exists (
      select 1 from outfits
      where outfits.id = outfit_items.outfit_id
      and outfits.user_id = auth.uid()
    )
  );

create policy "Accepted friends can read shared outfit items"
  on outfit_items for select using (
    exists (
      select 1 from outfits
      join friendships on friendships.status = 'accepted'
      where outfits.id = outfit_items.outfit_id
      and outfits.is_shareable = true
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = outfits.user_id)
        or (friendships.addressee_id = auth.uid() and friendships.requester_id = outfits.user_id)
      )
    )
  );

create policy "Public can read token shared outfit items"
  on outfit_items for select using (
    exists (
      select 1 from outfits
      where outfits.id = outfit_items.outfit_id
      and outfits.is_shareable = true
      and outfits.share_token is not null
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

create policy "Friends can create outfit vote notifications"
  on notifications for insert with check (
    type = 'outfit_vote'
    and exists (
      select 1 from outfits
      join friendships on friendships.status = 'accepted'
      where outfits.id = (notifications.data->>'outfit_id')::uuid
      and notifications.user_id = outfits.user_id
      and outfits.user_id != auth.uid()
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = outfits.user_id)
        or (friendships.addressee_id = auth.uid() and friendships.requester_id = outfits.user_id)
      )
    )
  );

create policy "Users can ask friends to vote on own outfits"
  on notifications for insert with check (
    type = 'outfit_vote'
    and exists (
      select 1 from outfits
      join friendships on friendships.status = 'accepted'
      where outfits.id = (notifications.data->>'outfit_id')::uuid
      and outfits.user_id = auth.uid()
      and outfits.is_shareable = true
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = notifications.user_id)
        or (friendships.addressee_id = auth.uid() and friendships.requester_id = notifications.user_id)
      )
    )
  );

create policy "Users can create friend request notifications"
  on notifications for insert with check (
    type = 'friend_request'
    and user_id != auth.uid()
    and exists (
      select 1 from friendships
      where friendships.status = 'pending'
      and friendships.requester_id = auth.uid()
      and friendships.addressee_id = notifications.user_id
      and friendships.id = (notifications.data->>'friendship_id')::uuid
    )
  );

create policy "Friends can request lendable wardrobe items"
  on notifications for insert with check (
    type = 'lend_request'
    and exists (
      select 1 from wardrobe_items
      join friendships on friendships.status = 'accepted'
      where wardrobe_items.id = (notifications.data->>'item_id')::uuid
      and wardrobe_items.user_id = notifications.user_id
      and wardrobe_items.is_active = true
      and wardrobe_items.is_shareable = true
      and wardrobe_items.is_lendable = true
      and notifications.user_id != auth.uid()
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = notifications.user_id)
        or (friendships.addressee_id = auth.uid() and friendships.requester_id = notifications.user_id)
      )
    )
  );

create policy "Loan owners can notify requesters"
  on notifications for insert with check (
    type = 'lend_request'
    and exists (
      select 1 from loan_requests
      where loan_requests.id = (notifications.data->>'loan_request_id')::uuid
      and loan_requests.owner_id = auth.uid()
      and loan_requests.requester_id = notifications.user_id
    )
  );

create policy "Users can read own friendships"
  on friendships for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send friend requests"
  on friendships for insert with check (
    auth.uid() = requester_id
    and exists (
      select 1 from profiles
      where profiles.id = friendships.addressee_id
      and coalesce((profiles.privacy_settings->>'allow_friend_requests')::boolean, true)
    )
  );

create policy "Users can update own friendships"
  on friendships for update using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can delete own friendships"
  on friendships for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can read own referral rewards"
  on referral_rewards for select using (
    auth.uid() = referrer_id
    or auth.uid() = referred_id
  );

create policy "Users can read related outfit votes"
  on outfit_votes for select using (
    voter_id = auth.uid()
    or exists (
      select 1 from outfits
      where outfits.id = outfit_votes.outfit_id
      and outfits.user_id = auth.uid()
    )
    or exists (
      select 1 from outfits
      join friendships on friendships.status = 'accepted'
      where outfits.id = outfit_votes.outfit_id
      and outfits.is_shareable = true
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = outfits.user_id)
        or (friendships.addressee_id = auth.uid() and friendships.requester_id = outfits.user_id)
      )
    )
  );

create policy "Friends can vote on shared outfits"
  on outfit_votes for insert with check (
    voter_id = auth.uid()
    and exists (
      select 1 from outfits
      join friendships on friendships.status = 'accepted'
      where outfits.id = outfit_votes.outfit_id
      and outfits.is_shareable = true
      and outfits.user_id != auth.uid()
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = outfits.user_id)
        or (friendships.addressee_id = auth.uid() and friendships.requester_id = outfits.user_id)
      )
    )
  );

create policy "Friends can update own outfit votes"
  on outfit_votes for update using (voter_id = auth.uid()) with check (voter_id = auth.uid());

create policy "Public can read token shared outfit votes"
  on outfit_votes for select using (
    exists (
      select 1 from outfits
      where outfits.id = outfit_votes.outfit_id
      and outfits.is_shareable = true
      and outfits.share_token is not null
    )
  );

create policy "Signed in users can vote on token shared outfits"
  on outfit_votes for insert with check (
    auth.uid() is not null
    and voter_id = auth.uid()
    and exists (
      select 1 from outfits
      where outfits.id = outfit_votes.outfit_id
      and outfits.is_shareable = true
      and outfits.share_token is not null
      and outfits.user_id != auth.uid()
    )
  );

create policy "Users can read related loan requests"
  on loan_requests for select using (
    owner_id = auth.uid()
    or requester_id = auth.uid()
  );

create policy "Friends can request lendable items"
  on loan_requests for insert with check (
    requester_id = auth.uid()
    and owner_id != auth.uid()
    and exists (
      select 1 from wardrobe_items
      join friendships on friendships.status = 'accepted'
      where wardrobe_items.id = loan_requests.item_id
      and wardrobe_items.user_id = loan_requests.owner_id
      and wardrobe_items.is_active = true
      and wardrobe_items.is_shareable = true
      and wardrobe_items.is_lendable = true
      and (
        (friendships.requester_id = auth.uid() and friendships.addressee_id = loan_requests.owner_id)
        or (friendships.addressee_id = auth.uid() and friendships.requester_id = loan_requests.owner_id)
      )
    )
  );

create policy "Loan owners can update status"
  on loan_requests for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

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
