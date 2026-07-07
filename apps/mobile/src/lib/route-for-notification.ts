import type { Href } from "expo-router";

export interface NotificationData {
  type: string;
  roomId?: string;
  proposalId?: string;
  partyId?: string;
  matchId?: string;
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
      // `as any` on pathname: Expo Router typegen (.expo/types/router.d.ts) is stale and
      // does not yet include the date-plan route added in Task 6; mirrors the cast in
      // apps/mobile/app/(app)/chat/[roomId].tsx for the same reason.
      return data.matchId
        ? { pathname: "/(app)/date-plan/[matchId]" as any, params: { matchId: data.matchId } }
        : "/(app)/home";
    case "system":
    default:
      return "/(app)/notifications";
  }
}
