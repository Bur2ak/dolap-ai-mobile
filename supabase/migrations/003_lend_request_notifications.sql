drop policy if exists "Friends can request lendable wardrobe items" on notifications;

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
