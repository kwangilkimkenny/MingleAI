import { Tabs } from "expo-router";
import { Home, MessageCircle, HeartHandshake, Bell, Settings } from "lucide-react-native";
import { colors, doodle, doodleHeaderOptions } from "../../../src/lib/theme";

/**
 * Fixed bottom tab bar (shown once the user is past onboarding). Doodle line-art:
 * Lucide outline icons, paper ground, a solid ink hairline on top (no soft shadow),
 * active = ink, inactive = muted gray.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        ...doodleHeaderOptions,
        // 상단 헤더 영역 제거 — 탭 화면은 하단 탭 바가 이미 각 화면을 라벨링한다.
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.grayMid,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopWidth: doodle.border,
          borderTopColor: colors.ink,
          elevation: 0,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "홈",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "채팅",
          tabBarIcon: ({ color, size }) => (
            <MessageCircle color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="proposals"
        options={{
          title: "프로포즈",
          tabBarIcon: ({ color, size }) => (
            <HeartHandshake color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "알림",
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
