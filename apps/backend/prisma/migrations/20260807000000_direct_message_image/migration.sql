-- 채팅 이미지 첨부: 메시지에 이미지 URL 한 칸.
-- IF NOT EXISTS — 로컬에서 먼저 손으로 넣어 본 개발 DB에서도 그대로 통과하도록.
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
