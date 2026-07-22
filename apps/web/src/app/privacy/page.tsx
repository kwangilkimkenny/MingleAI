import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보 처리 안내">
      <LegalSection title="수집하는 정보">계정 운영을 위해 이메일, 암호화된 비밀번호, 성인 확인과 약관 동의 시각을 처리합니다. 매칭과 프로필 제공을 위해 이름, 나이, 성별, 직업, 소개, 지역, 사진, 관심사와 선호 정보를 처리합니다.{"\n\n"}서비스 운영 과정에서 파티 참여, 게임 진행, 채팅, 프로포즈, 차단·신고, 알림 토큰, 접속 및 오류 기록이 생성될 수 있습니다.</LegalSection>
      <LegalSection title="이용 목적과 공유">정보는 본인 인증, 매칭, 게임·채팅 제공, 안전 조치, 고객지원과 서비스 안정화에 사용됩니다. 프로필 정보는 서비스 안의 다른 사용자에게 표시될 수 있습니다. 법적 의무, 명시적 동의 또는 서비스 제공에 필요한 처리 외에는 개인정보를 판매하지 않습니다.</LegalSection>
      <LegalSection title="보관과 삭제">계정 삭제 시 계정, 프로필, 매칭, 메시지와 연결된 서비스 데이터는 삭제됩니다. 분쟁 대응이나 법령상 의무가 있는 자료는 해당 목적과 기간에 한해 분리 보관한 뒤 삭제합니다.</LegalSection>
      <LegalSection title="사용자의 선택">설정에서 사진, 차단 목록, 푸시 알림과 계정 삭제를 관리할 수 있으며 기기 설정에서 사진·알림 권한을 언제든 철회할 수 있습니다.</LegalSection>
    </LegalPage>
  );
}
