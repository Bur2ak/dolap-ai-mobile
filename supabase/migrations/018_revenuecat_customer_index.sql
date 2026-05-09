create index if not exists idx_profiles_revenuecat_customer_id
  on profiles(revenuecat_customer_id)
  where revenuecat_customer_id is not null;
