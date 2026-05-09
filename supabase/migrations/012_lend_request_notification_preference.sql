alter table public.profiles
  alter column notification_preferences set default '{
    "outfit_reminder": true,
    "price_drops": true,
    "friend_requests": true,
    "outfit_votes": true,
    "lend_requests": true
  }'::jsonb;

update public.profiles
set notification_preferences = coalesce(notification_preferences, '{}'::jsonb) || '{"lend_requests": true}'::jsonb
where not coalesce(notification_preferences, '{}'::jsonb) ? 'lend_requests';
