import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage title="서비스 이용약관">
      <LegalSection title="1. 서비스와 이용 자격">MingleAI는 게임, 채팅, 프로포즈와 데이트 계획 기능을 제공하는 성인 대상 소셜 매칭 서비스입니다. 만 19세 이상만 계정을 만들 수 있습니다.{"\n\n"}괴롭힘, 사칭, 불법 행위, 동의 없는 개인정보 공개와 상업적 권유에 서비스를 사용할 수 없습니다.</LegalSection>
      <LegalSection title="2. 안전과 콘텐츠">사용자는 자신의 콘텐츠에 책임을 집니다. 운영팀은 신고 조사와 안전 확보를 위해 콘텐츠를 제한하거나 계정을 정지할 수 있습니다. AI 캐릭터의 발언과 게임 결과는 오락 목적이며 실제 사용자의 신원이나 의사를 대변하지 않습니다.</LegalSection>
      <LegalSection title="3. 오프라인 만남">만남 여부와 장소는 사용자가 결정합니다. 공개된 장소를 선택하고 신뢰하는 사람에게 일정을 공유하며 금전 요구나 신원 확인을 회피하는 상대를 주의해 주세요.</LegalSection>
      <LegalSection title="4. 계정 종료">앱 설정 또는 웹 계정 삭제 페이지에서 언제든 탈퇴할 수 있습니다. 법령상 보관 의무가 있는 최소 정보를 제외한 계정 연결 데이터는 삭제 후 복구할 수 없습니다.</LegalSection>
    </LegalPage>
  );
}
