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

alter table referral_rewards enable row level security;

drop policy if exists "Users can read own referral rewards" on referral_rewards;
create policy "Users can read own referral rewards"
  on referral_rewards for select using (
    auth.uid() = referrer_id
    or auth.uid() = referred_id
  );

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
