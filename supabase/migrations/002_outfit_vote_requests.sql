drop policy if exists "Users can ask friends to vote on own outfits" on notifications;

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
