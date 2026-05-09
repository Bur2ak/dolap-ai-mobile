#!/usr/bin/env sh
set -eu

functions="
analyze-clothing
remove-background
recommend-outfit
buy-decision
event-outfit
send-notification
price-check
revenuecat-webhook
process-account-deletions
"

for function_name in $functions; do
  echo "Deploying $function_name..."
  supabase functions deploy "$function_name"
done

echo "All Shipirio functions deployed."
