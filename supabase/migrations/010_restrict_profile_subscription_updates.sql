revoke update on table public.profiles from authenticated;

grant update (
  username,
  full_name,
  avatar_url,
  bio,
  notification_preferences,
  privacy_settings,
  onboarding_completed,
  push_token,
  deletion_requested_at,
  deletion_scheduled_for,
  updated_at
) on table public.profiles to authenticated;
