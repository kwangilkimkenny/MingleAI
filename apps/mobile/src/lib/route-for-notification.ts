import type { Href } from "expo-router";

export interface NotificationData {
  type: string;
  roomId?: string;
  proposalId?: string;
  partyId?: string;
}

export function routeForNotification(data: NotificationData): Href {
  switch (data.type) {
    case "message_received":
      return data.roomId
        ? { pathname: "/(app)/chat/[roomId]", params: { roomId: data.roomId } }
        : "/(app)/chats";
    case "match_made":
      return "/(app)/chats";
    case "proposal_received":
      return "/(app)/proposals";
    case "party_reminder":
    case "match_result":
      return "/(app)/home";
    case "reservation":
      return "/(app)/home"; // retargeted in Phase 5b
    case "system":
    default:
      return "/(app)/notifications";
  }
}
