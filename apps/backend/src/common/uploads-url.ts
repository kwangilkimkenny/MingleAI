/**
 * 업로드 URL 검증 — 우리 서버가 준 `/uploads/<파일명>`만 통과시킨다.
 *
 * 왜 호스트까지 보는가: pathname만 검사하면 `https://evil.example.com/uploads/tracker.png`가
 * 통과한다. 그 URL이 채팅 첨부나 프로필 사진으로 저장되면 상대 앱이 이미지를 로드하는 순간
 * IP·열람 시각이 공격자 서버로 간다(추적 픽셀 = 스토킹 벡터). 2026-08-11 QA 실측.
 *
 * PUBLIC_BASE_URL이 설정돼 있으면(운영) 그 origin만 허용한다. 개발에서는 그 값이 없어서
 * 기기가 LAN IP로 붙기 때문에(`http://10.0.2.2:3000/uploads/…`) 사설/루프백 호스트만 허용한다.
 */

const UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9._-]+$/;

/** 사설망·루프백 호스트인지 — 개발 기기(에뮬레이터·실기기 LAN)를 위한 예외. */
function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "::1" || h.endsWith(".local")) return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return true;
  return false;
}

/**
 * 우리 업로드 URL이면 그대로, 아니면 null.
 * @param pathTest 경로 추가 제약(예: 프로필 사진은 `<uuid>.<ext>`만).
 */
export function normalizeUploadUrl(
  raw?: string | null,
  pathTest: RegExp = UPLOAD_PATH,
): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  let path = value;
  if (/^https?:\/\//i.test(value)) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return null;
    }
    const publicBase = process.env.PUBLIC_BASE_URL?.trim();
    if (publicBase) {
      let base: URL;
      try {
        base = new URL(publicBase);
      } catch {
        return null;
      }
      if (parsed.origin !== base.origin) return null;
    } else if (!isLocalHostname(parsed.hostname)) {
      return null;
    }
    path = parsed.pathname;
  } else if (!value.startsWith("/")) {
    return null;
  }

  if (path.includes("..")) return null;
  return pathTest.test(path) ? value : null;
}

/** 프로필 사진 경로 — 업로드가 만드는 `<uuid>.<ext>`만. */
export const PROFILE_PHOTO_PATH = /^\/uploads\/[0-9a-f-]+\.(jpg|png|webp)$/i;
