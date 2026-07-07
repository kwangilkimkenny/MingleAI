import { routeForNotification } from "../route-for-notification";

it("routes message_received to the chat room with roomId", () => {
  expect(routeForNotification({ type: "message_received", roomId: "r1" })).toEqual({
    pathname: "/(app)/chat/[roomId]",
    params: { roomId: "r1" },
  });
});
it("routes proposal_received to proposals", () => {
  expect(routeForNotification({ type: "proposal_received" })).toBe("/(app)/proposals");
});
it("routes match_made to chats", () => {
  expect(routeForNotification({ type: "match_made" })).toBe("/(app)/chats");
});
it("falls back to the notification center for system/unknown", () => {
  expect(routeForNotification({ type: "system" })).toBe("/(app)/notifications");
  expect(routeForNotification({ type: "whatever" as any })).toBe("/(app)/notifications");
});
it("message_received without roomId falls back to chats", () => {
  expect(routeForNotification({ type: "message_received" })).toBe("/(app)/chats");
});
it("routes reservation with matchId to the date-plan screen", () => {
  expect(routeForNotification({ type: "reservation", matchId: "m1" })).toEqual({
    pathname: "/(app)/date-plan/[matchId]",
    params: { matchId: "m1" },
  });
});
it("routes reservation without matchId to home", () => {
  expect(routeForNotification({ type: "reservation" })).toBe("/(app)/home");
});
