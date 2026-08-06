-- 파티 게임(AI를 찾아라)·프로포즈 전면 제거 (2026-08-06 사용자 결정).
-- 로테이션 블라인드 스피드 데이트가 유일한 매칭 루프 — 파티·게임·파티 매칭 큐·프로포즈 테이블과
-- 참조 컬럼을 모두 삭제한다. Match/DM은 스피드데이트 상호선택이 계속 사용하므로 유지.

-- Match에서 파티·프로포즈 참조 제거
ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_party_id_fkey";
ALTER TABLE "matches" DROP COLUMN IF EXISTS "party_id";
ALTER TABLE "matches" DROP COLUMN IF EXISTS "proposal_id";

-- SafetyReport에서 파티 근거 컬럼 제거
ALTER TABLE "safety_reports" DROP COLUMN IF EXISTS "evidence_party_id";

-- 파티 계열 테이블 삭제 (FK 역순)
DROP TABLE IF EXISTS "proposals";
DROP TABLE IF EXISTS "game_sessions";
DROP TABLE IF EXISTS "party_messages";
DROP TABLE IF EXISTS "party_participants";
DROP TABLE IF EXISTS "matchmaking_queue_entries";
DROP TABLE IF EXISTS "parties";
