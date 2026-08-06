import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../src/components/AppScreen";
import { dark, space, type } from "../src/lib/theme";
import { LEGAL_UPDATED_AT, TERMS_SECTIONS } from "../src/lib/legal-content";

export default function TermsScreen() {
  return (
    <AppScreen
      tone="dark"
      header={{
        back: true,
        title: "서비스 이용약관",
        description: `시행일 ${LEGAL_UPDATED_AT}`,
      }}
      body="scroll"
    >
      <View style={styles.column}>
        {TERMS_SECTIONS.map((section) => (
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
