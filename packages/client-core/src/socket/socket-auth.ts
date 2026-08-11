import { getClientConfig, getToken } from "../config.js";

/**
 * 소켓 인증 토큰 관리 — 액세스 토큰은 1시간이면 만료된다.
 *
 * 예전에는 연결 시점 토큰을 그대로 들고 살았다. 그래서 채팅방에 오래 머문 뒤 네트워크가 한 번
 * 끊기면 핸드셰이크가 `unauthorized`로 떨어지고, socket.io는 **같은 만료 토큰으로** 재시도를
 * 반복해 소켓이 조용히 죽었다. 메시지를 보내는 쪽은 REST가 401→refresh로 되살렸지만,
 * 받기만 하는 쪽은 복구 계기가 없었다(2026-08-11 감사).
 *
 * 두 겹으로 막는다:
 *  1. `authProvider()` — socket.io는 재연결마다 auth 콜백을 다시 부른다. 항상 최신 토큰을 읽는다.
 *  2. `attachAuthRefresh()` — 그래도 unauthorized면 refresh를 한 번 돌리고 다시 붙는다.
 */

/** socket.io `auth` 콜백. 재연결 때마다 저장소의 최신 토큰을 읽는다. */
export function authProvider(fallbackToken: string) {
  return (cb: (data: { token: string }) => void) => cb({ token: getToken() ?? fallbackToken });
}

/** refresh를 반복해도 계속 거절당하면(정지 계정 등) 이만큼 시도하고 로그아웃으로 넘긴다. */
const MAX_REFRESH_ATTEMPTS = 3;

export function attachAuthRefresh(socket: {
  on(event: string, fn: (arg?: unknown) => void): void;
  connect?: () => void;
}): void {
  let refreshing = false;
  let attempts = 0;

  socket.on("connect", () => {
    attempts = 0;
  });

  socket.on("connect_error", (err?: unknown) => {
    const message = String((err as { message?: string })?.message ?? err ?? "");
    // 네트워크 단절은 socket.io의 재연결에 맡긴다 — 토큰 문제일 때만 개입한다.
    if (!/unauthorized/i.test(message) || refreshing) return;
    if (attempts >= MAX_REFRESH_ATTEMPTS) {
      getClientConfig().onUnauthorized?.();
      return;
    }
    attempts += 1;
    refreshing = true;
    const refresh = getClientConfig().refreshAccessToken;
    if (!refresh) {
      refreshing = false;
      getClientConfig().onUnauthorized?.();
      return;
    }
    void refresh()
      .then((next) => {
        // 새 토큰은 authProvider가 읽는다 — 여기서는 다시 붙이기만 한다.
        if (next) socket.connect?.();
        else getClientConfig().onUnauthorized?.();
      })
      .catch(() => getClientConfig().onUnauthorized?.())
      .finally(() => {
        refreshing = false;
      });
  });
}
