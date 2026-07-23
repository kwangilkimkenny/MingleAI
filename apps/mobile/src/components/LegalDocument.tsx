import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ContentColumn, PageHeader } from "./Foundation";
import { colors, layout, space, type } from "../lib/theme";

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export function LegalDocument({
  title,
  updatedAt,
  sections,
}: {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ContentColumn style={styles.column}>
        <PageHeader back title={title} description={`시행일 ${updatedAt}`} />
        {sections.map((section) => (
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
      </ContentColumn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: layout.screenGutter, paddingBottom: space.x8 },
  column: { gap: space.x5 },
  section: { gap: space.x2 },
  heading: { ...type.title, color: colors.heading },
  body: { ...type.body, color: colors.grayDark, lineHeight: 24 },
});
