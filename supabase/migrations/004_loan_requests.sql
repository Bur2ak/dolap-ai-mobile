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

alter table loan_requests enable row level security;

drop policy if exists "Users can read related loan requests" on loan_requests;
create policy "Users can read related loan requests"
  on loan_requests for select using (
    owner_id = auth.uid()
    or requester_id = auth.uid()
  );

drop policy if exists "Friends can request lendable items" on loan_requests;
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

drop policy if exists "Loan owners can update status" on loan_requests;
create policy "Loan owners can update status"
  on loan_requests for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Loan owners can notify requesters" on notifications;
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
