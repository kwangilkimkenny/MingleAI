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
        headerTitle: "MingleAI",
        tabBarActiveTintColor: colors.ink,
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
