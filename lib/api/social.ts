import { supabase } from "@/lib/supabase";
import type { FriendWardrobe, Friendship, UserSearchResult } from "@/types";

export async function searchUsers(query: string, currentUserId: string): Promise<UserSearchResult[]> {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .or(`username.ilike.%${normalized}%,full_name.ilike.%${normalized}%`)
    .neq("id", currentUserId)
    .limit(10);

  if (error) {
    throw error;
  }

  return (data ?? []) as UserSearchResult[];
}

export async function fetchFriendships(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Friendship[];
}

export async function sendFriendRequest(userId: string, addresseeId: string): Promise<void> {
  const { data, error } = await supabase
    .from("friendships")
    .insert({
      requester_id: userId,
      addressee_id: addresseeId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  const { error: notificationError } = await supabase.from("notifications").insert({
    user_id: addresseeId,
    type: "friend_request",
    title: "Yeni arkadaslik istegi",
    body: "Bir Shipirio kullanicisi sana arkadaslik istegi gonderdi.",
    data: {
      friendship_id: data.id,
      requester_id: userId,
    },
  });

  if (notificationError) {
    throw notificationError;
  }
}

export async function updateFriendshipStatus(userId: string, friendshipId: string, status: "accepted" | "blocked"): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({ status })
    .eq("id", friendshipId)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) {
    throw error;
  }
}

export async function deleteFriendship(userId: string, friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) {
    throw error;
  }
}

export async function fetchFriendWardrobe(friendId: string): Promise<FriendWardrobe> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, bio, privacy_settings")
    .eq("id", friendId)
    .single();

  if (profileError) {
    throw profileError;
  }

  const { data: items, error: itemsError } = await supabase
    .from("wardrobe_items")
    .select("*")
    .eq("user_id", friendId)
    .eq("is_active", true)
    .eq("is_shareable", true)
    .order("created_at", { ascending: false });

  if (itemsError) {
    throw itemsError;
  }

  return {
    profile: profile as FriendWardrobe["profile"],
    items: (items ?? []) as FriendWardrobe["items"],
  };
}
