create unique index if not exists idx_friendships_unique_pair
  on friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );
