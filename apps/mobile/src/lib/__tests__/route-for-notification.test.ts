import { routeForNotification } from "../route-for-notification";

it("routes message_received to the chat room with roomId", () => {
  expect(routeForNotification({ type: "message_received", roomId: "r1" })).toEqual({
    pathname: "/(app)/chat/[roomId]",
    params: { roomId: "r1" },
  });
});
it("routes match_made to chats", () => {
  expect(routeForNotification({ type: "match_made" })).toBe("/chats");
});
it("falls back to home for system/unknown (notifications is a home popup now)", () => {
  expect(routeForNotification({ type: "system" })).toBe("/home");
  expect(routeForNotification({ type: "whatever" as any })).toBe("/home");
});
it("message_received without roomId falls back to chats", () => {
  expect(routeForNotification({ type: "message_received" })).toBe("/chats");
});
it("routes reservation with matchId to the date-plan screen", () => {
  expect(routeForNotification({ type: "reservation", matchId: "m1" })).toEqual({
    pathname: "/(app)/date-plan/[matchId]",
    params: { matchId: "m1" },
  });
});
it("routes reservation without matchId to home", () => {
  expect(routeForNotification({ type: "reservation" })).toBe("/home");
});
