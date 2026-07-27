import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../src/components/AppScreen";
import { dark, space, type } from "../src/lib/theme";

const UPDATED_AT = "2026년 7월 27일";

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: "수집하는 정보",
    paragraphs: [
      "계정 운영을 위해 소셜 로그인 계정 정보(이메일), 본인인증 결과와 약관 동의 시각을 처리합니다. 매칭과 프로필 제공을 위해 이름, 나이, 성별, 직업, 소개, 지역, 사진, 관심사와 선호 정보를 처리하며, 매칭 거리를 설정한 경우 위치 정보를 함께 처리합니다.",
      "서비스 운영 과정에서 소개팅 참여, 상호 선택, 채팅, 데이트 계획, 차단·신고, 알림 토큰, 접속 및 오류 기록이 생성될 수 있습니다. 음성·영상 대화 내용은 저장하지 않습니다.",
    ],
  },
  {
    title: "이용 목적과 공유",
    paragraphs: [
      "정보는 본인인증, 매칭, 소개팅·채팅 제공, 안전 조치, 고객지원과 서비스 안정화에 사용됩니다. AI는 선호 분석과 매칭 추천에만 사용됩니다. 프로필 정보는 소개팅의 공개 단계에 따라 다른 사용자에게 표시될 수 있으며, 위치 정보는 매칭 거리 적용과 주변 맛집 안내에만 사용됩니다.",
      "법적 의무 이행, 사용자의 명시적 동의 또는 서비스 제공에 필요한 처리업체 이용 외에는 개인정보를 판매하지 않습니다.",
    ],
  },
  {
    title: "보관과 삭제",
    paragraphs: [
      "계정 삭제 시 계정, 프로필, 매칭, 메시지와 연결된 서비스 데이터는 삭제됩니다. 분쟁 대응이나 법령상 의무가 있는 자료는 해당 목적과 기간에 한해 분리 보관한 뒤 삭제합니다.",
    ],
  },
  {
    title: "사용자의 선택",
    paragraphs: [
      "설정에서 사진, 차단 목록, 푸시 알림과 계정 삭제를 관리할 수 있습니다. 기기 설정에서 카메라·마이크·사진·알림 권한을 언제든 철회할 수 있습니다(카메라·마이크는 소개팅 이용에 필요합니다).",
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <AppScreen
      tone="dark"
      header={{ back: true, title: "개인정보 처리 안내", description: `시행일 ${UPDATED_AT}` }}
      body="scroll"
    >
      <View style={styles.column}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text accessibilityRole="header" style={styles.heading}>
              {section.title}
            </Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={styles.body}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  column: { gap: space.x5 },
  section: { gap: space.x2 },
  heading: { ...type.title, color: dark.heading },
  body: { ...type.body, color: dark.text, lineHeight: 24 },
});
