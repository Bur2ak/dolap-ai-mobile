drop policy if exists "Users can vote on own outfits" on outfit_votes;

create policy "Users can vote on own outfits"
  on outfit_votes for insert with check (
    voter_id = auth.uid()
    and exists (
      select 1 from outfits
      where outfits.id = outfit_votes.outfit_id
      and outfits.user_id = auth.uid()
    )
  );
