import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { AlertCircle, ChevronLeft, X } from "lucide-react-native";
import { router } from "expo-router";
import { colors, control, dark, doodle, layout, shadow, space, type } from "../lib/theme";
import { serifFont } from "../lib/serif";
import { DoodleButton } from "./Doodle";
import { DoodleFace } from "./DoodleSvg";
import { useReducedMotion } from "react-native-reanimated";
import { useInitialAccessibilityFocus } from "../lib/accessibility";
import { hapticImpact, hapticWarning } from "../lib/haptics";

export function ContentColumn({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.column, style]}>{children}</View>;
}

export function PageHeader({
  title,
  description,
  back = false,
  action,
  dark: isDark = false,
}: {
  title: string;
  description?: string;
  back?: boolean;
  action?: ReactNode;
  /** 홈 테마 다크 화면용 — 타이틀/뒤로가기/설명을 크림 톤으로. */
  dark?: boolean;
}) {
  return (
    <View style={styles.pageHeader}>
      {back ? (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={4}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <ChevronLeft color={isDark ? dark.text : colors.ink} size={24} strokeWidth={2.5} />
        </Pressable>
      ) : null}
      <View style={styles.pageHeaderText}>
        <Text
          accessibilityRole="header"
          style={[styles.pageTitle, isDark && { fontFamily: serifFont, color: dark.heading }]}
        >
          {title}
        </Text>
        {description ? (
          <Text style={[styles.pageDescription, isDark && { color: dark.textMuted }]}>
            {description}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.pageAction}>{action}</View> : null}
    </View>
  );
}

export function LabeledInput({
  label,
  hint,
  error,
  trailing,
  style,
  dark: isDark = false,
  ...props
}: TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
  trailing?: ReactNode;
  /** 홈 테마 다크 화면용 폼 필드. */
  dark?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, isDark && { color: dark.text }]}>{label}</Text>
      <View
        style={[
          styles.inputFrame,
          props.multiline && styles.inputFrameMultiline,
          isDark && { borderColor: dark.border, backgroundColor: dark.fieldBg },
        ]}
      >
        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          placeholderTextColor={isDark ? dark.textMuted : colors.grayMid}
          style={[styles.input, props.multiline && styles.multilineInput, isDark && { color: dark.text }, style]}
        />
        {trailing ? <View style={styles.inputTrailing}>{trailing}</View> : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="assertive" style={[styles.fieldError, isDark && { color: dark.danger }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.fieldHint, isDark && { color: dark.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function IconButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      {icon ?? <X color={colors.ink} size={20} />}
    </Pressable>
  );
}

export function InlineNotice({
  children,
  tone = "neutral",
  dark: isDark = false,
}: {
  children: ReactNode;
  tone?: "neutral" | "error" | "success";
  /** 홈 테마 다크 화면용. */
  dark?: boolean;
}) {
  const color =
    tone === "error"
      ? isDark
        ? dark.danger
        : colors.danger
      : tone === "success"
        ? colors.success
        : isDark
          ? dark.text
          : colors.ink;
  return (
    <View
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
      style={[styles.notice, { borderColor: color }, isDark && { backgroundColor: dark.surface }]}
    >
      {tone === "error" ? <AlertCircle color={color} size={18} /> : null}
      <Text style={[styles.noticeText, { color }]}>{children}</Text>
    </View>
  );
}

export function StateView({
  title,
  body,
  actionLabel,
  onAction,
  loading = false,
  dark: isDark = false,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
  /** 홈 테마 다크 화면용 빈/로딩/에러 상태. */
  dark?: boolean;
}) {
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      {loading ? (
        <ActivityIndicator size="large" color={isDark ? dark.accent : colors.accent} />
      ) : (
        <DoodleFace variant="flat" size={64} />
      )}
      <Text accessibilityRole="header" style={[styles.stateTitle, isDark && { color: dark.text }]}>
        {title}
      </Text>
      {body ? <Text style={[styles.stateBody, isDark && { color: dark.textMuted }]}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.stateAction}>
          <DoodleButton
            title={actionLabel}
            onPress={onAction}
            variant="primary"
            tone={isDark ? "dark" : "light"}
          />
        </View>
      ) : null}
    </View>
  );
}

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = "취소",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const focusRef = useInitialAccessibilityFocus(visible);
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.dialogRoot} accessibilityViewIsModal>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityLabel={`${title} 닫기`}
        />
        <View style={styles.dialogCard}>
          <View ref={focusRef} accessible accessibilityRole="header" accessibilityLabel={title}>
            <Text style={styles.dialogTitle}>{title}</Text>
          </View>
          <Text style={styles.dialogBody}>{body}</Text>
          <View style={styles.dialogActions}>
            <View style={styles.dialogAction}>
              <DoodleButton title={cancelLabel} onPress={onCancel} disabled={busy} />
            </View>
            <View style={styles.dialogAction}>
              <DoodleButton
                title={busy ? "처리 중..." : confirmLabel}
                onPress={() => {
                  if (destructive) hapticWarning();
                  else hapticImpact();
                  onConfirm();
                }}
                disabled={busy}
                variant={destructive ? "dangerSolid" : "primary"}
                serious
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  column: {
    width: "100%",
    maxWidth: layout.contentMax,
    alignSelf: "center",
  },
  pageHeader: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.x2,
    paddingTop: space.x2,
    paddingBottom: space.x3,
  },
  pageHeaderText: { flex: 1, minWidth: 0 },
  pageTitle: { ...type.display, fontSize: 26, lineHeight: 31, letterSpacing: -0.6, color: colors.ink },
  pageDescription: { ...type.body, color: colors.grayDark, marginTop: space.x1 },
  pageAction: { minHeight: control.minTouch, justifyContent: "center" },
  backButton: {
    width: control.minTouch,
    height: control.minTouch,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -space.x2,
  },
  field: { gap: space.x2 },
  fieldLabel: { ...type.label, color: colors.ink },
  inputFrame: {
    borderWidth: doodle.border,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...doodle.radius.input,
    minHeight: 52,
    paddingVertical: 0,
    paddingHorizontal: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  inputFrameMultiline: { alignItems: "flex-start", minHeight: 112 },
  input: {
    ...type.body,
    color: colors.ink,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multilineInput: { minHeight: 108, textAlignVertical: "top" },
  inputTrailing: { paddingRight: space.x1 },
  fieldHint: { ...type.caption, color: colors.grayDark },
  fieldError: { ...type.caption, color: colors.danger },
  iconButton: {
    width: control.minTouch,
    height: control.minTouch,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  pressed: { opacity: 0.65 },
  notice: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: space.x2,
    paddingHorizontal: space.x3,
    paddingVertical: space.x2,
    borderWidth: 1.5,
    backgroundColor: colors.fill,
    ...doodle.radius.input,
  },
  noticeText: { ...type.caption, flex: 1 },
  state: {
    flex: 1,
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: space.x2,
    paddingHorizontal: layout.screenGutter,
    paddingVertical: space.x8,
  },
  stateTitle: { ...type.heading, color: colors.ink, textAlign: "center" },
  stateBody: { ...type.body, color: colors.grayDark, textAlign: "center", maxWidth: 360 },
  stateAction: { width: "100%", maxWidth: 320, marginTop: space.x3 },
  dialogRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: layout.screenGutter,
    backgroundColor: "rgba(42,34,40,0.55)",
  },
  dialogCard: {
    width: "100%",
    maxWidth: layout.modalMax,
    gap: space.x3,
    padding: space.x5,
    backgroundColor: colors.card,
    borderWidth: doodle.border,
    borderColor: colors.border,
    ...doodle.radius.card,
    ...shadow.elevated,
  },
  dialogTitle: { ...type.title, color: colors.heading },
  dialogBody: { ...type.body, color: colors.grayDark },
  dialogActions: { flexDirection: "row", gap: space.x2, marginTop: space.x2 },
  dialogAction: { flex: 1 },
});
