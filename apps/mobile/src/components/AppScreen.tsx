import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, dark, layout, space } from "../lib/theme";
import { ContentColumn, PageHeader } from "./Foundation";
import { useTabBarClearance } from "./DoodleTabBar";

/** 탭 화면은 `title` 없이 `action`만 넘겨 아이콘 줄만 남긴다(탭 이름을 화면에서 반복하지 않는다). */
type HeaderProps = { title?: string; description?: string; back?: boolean; action?: ReactNode };

/**
 * 유일한 화면 래퍼 — SafeArea·paper 배경·헤더존·폭 캡·탭 클리어런스·하단 고정 footer를 흡수한다.
 * 화면 파일은 콘텐츠만 넣는다(자체 SafeArea/헤더/컨테이너 배선 금지). Immersive(스피드데이트 세션·
 * 파티 월드)만 이 래퍼 밖에서 자체 크롬을 가진다.
 *
 * - `header`: PageHeader(Foundation) 재사용. 탭 화면은 back 없이 title만, 상세는 back:true.
 * - `body`: "scroll"(기본) = ScrollView, "plain" = 고정 높이(리스트를 children이 직접 관리).
 * - `footer`: 하단 고정 primary 액션존(옵션). 있으면 하단 여백은 footer가 담당.
 * - `tabScreen`: 탭 바 위에 뜨는 화면 — 하단에 탭 클리어런스만큼 패딩.
 */
export function AppScreen({
  header,
  body = "scroll",
  footer,
  tabScreen = false,
  bleed,
  tone = "light",
  keyboardAware = false,
  contentStyle,
  children,
}: {
  header?: HeaderProps;
  body?: "scroll" | "plain";
  footer?: ReactNode;
  tabScreen?: boolean;
  /** Full-width node rendered above the gutter'd content (heroes/banners that bleed to the edges). */
  bleed?: ReactNode;
  /** "dark" = 홈 테마(다크 에디토리얼) 화면. 리스트/데이터 화면은 기본 "light". */
  tone?: "light" | "dark";
  /** 입력 폼 화면 — 키보드가 뜰 때 콘텐츠·하단 footer를 함께 밀어올린다(작은 화면서 CTA 가림 방지). */
  keyboardAware?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const clearance = useTabBarClearance();
  const bottomPad = (tabScreen ? clearance : insets.bottom) + (footer ? 0 : space.x4);
  const isDark = tone === "dark";
  const bg = isDark ? dark.bg : colors.paper;

  const head = header ? (
    <ContentColumn style={styles.gutter}>
      <PageHeader
        title={header.title}
        description={header.description}
        back={header.back}
        action={header.action}
        dark={isDark}
      />
    </ContentColumn>
  ) : null;

  const inner =
    body === "scroll" ? (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[{ paddingBottom: bottomPad }, contentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {head}
        {bleed}
        <ContentColumn style={styles.gutter}>{children}</ContentColumn>
      </ScrollView>
    ) : (
      <View style={[styles.flex, { paddingBottom: bottomPad }]}>
        {head}
        {bleed}
        <ContentColumn style={[styles.gutter, styles.flex]}>{children}</ContentColumn>
      </View>
    );

  const footerNode = footer ? (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: bg,
          borderTopColor: isDark ? dark.line : colors.line,
          paddingBottom: insets.bottom + space.x3,
        },
      ]}
    >
      <ContentColumn style={styles.gutter}>{footer}</ContentColumn>
    </View>
  ) : null;

  const stack = (
    <>
      {inner}
      {footerNode}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top}
        >
          {stack}
        </KeyboardAvoidingView>
      ) : (
        stack
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  gutter: { paddingHorizontal: layout.screenGutter },
  footer: { borderTopWidth: 1, paddingTop: space.x3 },
});
