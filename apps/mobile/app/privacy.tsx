import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../src/components/AppScreen";
import { colors, space, type } from "../src/lib/theme";

const UPDATED_AT = "2026년 7월 22일";

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: "수집하는 정보",
    paragraphs: [
      "계정 운영을 위해 이메일, 암호화된 비밀번호, 성인 확인과 약관 동의 시각을 처리합니다. 매칭과 프로필 제공을 위해 이름, 나이, 성별, 직업, 소개, 지역, 사진, 관심사와 선호 정보를 처리합니다.",
      "서비스 운영 과정에서 파티 참여, 게임 진행, 채팅, 프로포즈, 차단·신고, 알림 토큰, 접속 및 오류 기록이 생성될 수 있습니다.",
    ],
  },
  {
    title: "이용 목적과 공유",
    paragraphs: [
      "정보는 본인 인증, 매칭, 게임·채팅 제공, 안전 조치, 고객지원과 서비스 안정화에 사용됩니다. 프로필 정보는 서비스 안의 다른 사용자에게 표시될 수 있습니다.",
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
      "설정에서 사진, 차단 목록, 푸시 알림과 계정 삭제를 관리할 수 있습니다. 기기 설정에서 사진·알림 권한을 언제든 철회할 수 있습니다.",
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <AppScreen
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
  heading: { ...type.title, color: colors.heading },
  body: { ...type.body, color: colors.grayDark, lineHeight: 24 },
});
