-- 동시 접속 최적화: 쿼리 빈도가 높은 컬럼에 복합 인덱스 추가

-- 파티 목록 필터링 (status + 정렬 기준 scheduledAt)
CREATE INDEX IF NOT EXISTS "parties_status_scheduled_at_idx" ON "parties"("status", "scheduled_at");

-- 파티 참가자 역방향 조회 (profileId 기준 참여 파티 검색)
CREATE INDEX IF NOT EXISTS "party_participants_profile_id_idx" ON "party_participants"("profile_id");

-- 예약 목록 조회 (profileId별 상태 필터)
CREATE INDEX IF NOT EXISTS "party_reservations_profile_id_status_idx" ON "party_reservations"("profile_id", "status");

-- 파티 예약 현황 집계 (partyId별 confirmed 수 카운트)
CREATE INDEX IF NOT EXISTS "party_reservations_party_id_status_idx" ON "party_reservations"("party_id", "status");

-- 매칭 리포트 조회 (profileId 기준)
CREATE INDEX IF NOT EXISTS "reports_profile_id_idx" ON "reports"("profile_id");

-- 안전 신고 관리자 목록 (status + createdAt 정렬)
CREATE INDEX IF NOT EXISTS "safety_reports_status_created_at_idx" ON "safety_reports"("status", "created_at");
