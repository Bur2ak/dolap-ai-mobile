drop policy if exists "Public can read token shared outfits" on outfits;
create policy "Public can read token shared outfits"
  on outfits for select using (
    is_shareable = true
    and share_token is not null
  );

drop policy if exists "Public can read token shared outfit items" on outfit_items;
create policy "Public can read token shared outfit items"
  on outfit_items for select using (
    exists (
      select 1 from outfits
      where outfits.id = outfit_items.outfit_id
      and outfits.is_shareable = true
      and outfits.share_token is not null
    )
  );

drop policy if exists "Public can read token shared outfit wardrobe" on wardrobe_items;
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

drop policy if exists "Public can read token shared outfit votes" on outfit_votes;
create policy "Public can read token shared outfit votes"
  on outfit_votes for select using (
    exists (
      select 1 from outfits
      where outfits.id = outfit_votes.outfit_id
      and outfits.is_shareable = true
      and outfits.share_token is not null
    )
  );

drop policy if exists "Signed in users can vote on token shared outfits" on outfit_votes;
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
