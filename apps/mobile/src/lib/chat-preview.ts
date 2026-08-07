/**
 * 채팅 목록의 마지막 메시지 한 줄. 사진만 보낸 메시지는 본문이 비어 있어(캡션 없이 사진만
 * 보내는 게 흔하다) 그대로 두면 목록이 빈칸처럼 보인다 — "사진"으로 대신 보여준다.
 */
export interface PreviewMessage {
  content?: string | null;
  imageUrl?: string | null;
}

export function messagePreview(last: PreviewMessage | null | undefined): string {
  if (!last) return "새로운 대화를 시작해 보세요";
  const text = (last.content ?? "").replace(/\s+/g, " ").trim();
  if (text) return last.imageUrl ? `사진 · ${text}` : text;
  return last.imageUrl ? "사진" : "새로운 대화를 시작해 보세요";
}
