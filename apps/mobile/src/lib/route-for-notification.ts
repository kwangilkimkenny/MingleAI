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
        : "/chats";
    case "match_made":
      return "/chats";
    case "proposal_received":
      // 프로포즈는 이제 페이지가 아니라 홈의 팝업 — 딥링크는 홈으로 보낸다.
      return "/home";
    case "party_reminder":
    case "match_result":
      return "/home";
    case "reservation":
      // `as any` on pathname: Expo Router typegen (.expo/types/router.d.ts) is stale and
      // does not yet include the date-plan route added in Task 6; mirrors the cast in
      // apps/mobile/app/(app)/chat/[roomId].tsx for the same reason.
      return data.matchId
        ? { pathname: "/(app)/date-plan/[matchId]" as any, params: { matchId: data.matchId } }
        : "/home";
    case "system":
    default:
      // 알림도 페이지가 아니라 홈의 팝업 — 딥링크는 홈으로.
      return "/home";
  }
}
