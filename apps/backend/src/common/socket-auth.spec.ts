import { socketAuthMiddleware } from "./socket-auth";

/**
 * 핸드셰이크 미들웨어가 소켓의 유일한 인증 관문이다. 여기를 통과하면 이후 모든 이벤트 핸들러가
 * `socket.data.userId`를 신뢰한다 — 통과 조건이 느슨해지면 게이트웨이 전체가 뚫린다.
 */
function run(
  jwtVerify: () => unknown,
  findActive: () => Promise<unknown>,
  token?: string,
) {
  const socket = { handshake: { auth: token ? { token } : {} }, data: {} as Record<string, unknown> };
  const next = jest.fn();
  const mw = socketAuthMiddleware(
    { verify: jwtVerify } as never,
    { findActive } as never,
  );
  return { promise: mw(socket as never, next), socket, next };
}

const ok = () => Promise.resolve({ userId: "u1", role: "user" });

describe("socketAuthMiddleware", () => {
  it("유효한 토큰 + 활성 계정이면 통과하고 userId/role을 심는다", async () => {
    const { promise, socket, next } = run(() => ({ sub: "acct1" }), ok, "good.token");
    await promise;

    expect(next).toHaveBeenCalledWith();
    expect(socket.data).toMatchObject({ userId: "u1", role: "user" });
  });

  it("토큰이 없으면 거절한다", async () => {
    const verify = jest.fn();
    const { promise, socket, next } = run(verify, ok);
    await promise;

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "unauthorized" }));
    expect(verify).not.toHaveBeenCalled();
    expect(socket.data.userId).toBeUndefined();
  });

  it("서명이 깨졌거나 만료된 토큰은 거절한다(throw를 삼키지 않는다)", async () => {
    const { promise, socket, next } = run(
      () => {
        throw new Error("jwt expired");
      },
      ok,
      "expired.token",
    );
    await promise;

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "unauthorized" }));
    expect(socket.data.userId).toBeUndefined();
  });

  // 정지·탈퇴 계정은 토큰이 아직 살아 있어도 들어오면 안 된다.
  it("계정이 비활성이면 토큰이 멀쩡해도 거절한다", async () => {
    const { promise, socket, next } = run(() => ({ sub: "acct1" }), () => Promise.resolve(null), "good.token");
    await promise;

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "unauthorized" }));
    expect(socket.data.userId).toBeUndefined();
  });

  it("계정 조회가 터져도 연결을 열어주지 않는다", async () => {
    const { promise, next } = run(
      () => ({ sub: "acct1" }),
      () => Promise.reject(new Error("db down")),
      "good.token",
    );
    await promise;

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "unauthorized" }));
  });
});
