export const EVENTS = {
  // Auth
  USER_SIGNED_UP: "user_signed_up",
  USER_SIGNED_IN: "user_signed_in",
  USER_SIGNED_OUT: "user_signed_out",
  ONBOARDING_VIEWED: "onboarding_screen_viewed",

  // Wardrobe
  WARDROBE_VIEWED: "wardrobe_screen_viewed",
  ITEM_ADD_OPENED: "wardrobe_add_item_sheet_opened",
  ITEM_ANALYZED: "wardrobe_image_analyzed",
  ITEM_CREATED: "wardrobe_item_created",
  ITEM_UPDATED: "wardrobe_item_updated",
  ITEM_DELETED: "wardrobe_item_deleted",
  ITEM_WORN: "wardrobe_item_worn",

  // Outfit
  OUTFIT_SCREEN_VIEWED: "outfit_screen_viewed",
  OUTFIT_RECOMMENDED: "outfit_recommendation_generated",
  OUTFIT_SAVED: "outfit_recommendation_saved",
  OUTFIT_WORN: "outfit_worn",
  OUTFIT_SHARED: "outfit_shared",
  OUTFIT_VOTE_SUBMITTED: "outfit_vote_submitted",
  OUTFIT_FRIEND_VOTE_REQUESTED: "outfit_friend_vote_requested",

  // Buy Decision
  BUY_DECISION_VIEWED: "buy_decision_screen_viewed",
  BUY_DECISION_ANALYZED: "buy_decision_analyzed",
  BUY_DECISION_SAVED: "buy_decision_saved",

  // Event Planner
  EVENT_PLANNER_VIEWED: "event_planner_screen_viewed",
  EVENT_OUTFIT_RECOMMENDED: "event_outfit_recommendation_generated",
  EVENT_SAVED: "event_plan_saved",
  EVENT_CALENDAR_ADDED: "event_calendar_added",

  // Analytics
  ANALYTICS_VIEWED: "analytics_screen_viewed",
  ANALYTICS_SHARED: "analytics_summary_shared",

  // Social
  FRIENDS_VIEWED: "friends_screen_viewed",
  FRIEND_REQUEST_SENT: "friend_request_sent",
  FRIENDSHIP_ACCEPTED: "friendship_status_changed",
  INVITE_SHARED: "invite_link_shared",

  // Price Tracking
  PRICE_TRACKING_ITEM_CREATED: "price_tracking_item_created",
  PRICE_DROP_NOTIFIED: "price_drop_notified",

  // Monetization
  PAYWALL_VIEWED: "paywall_viewed",
  PURCHASE_STARTED: "purchase_started",
  PURCHASE_COMPLETED: "purchase_completed",
  PURCHASE_RESTORED: "purchases_restored",

  // Notifications
  PUSH_ENABLED: "push_enable_requested",
  REMINDER_SCHEDULED: "smart_outfit_reminder_scheduled",
  REMINDER_CANCELLED: "smart_outfit_reminder_cancelled",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
