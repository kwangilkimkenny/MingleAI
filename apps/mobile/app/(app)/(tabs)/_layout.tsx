import { Tabs } from "expo-router";
import { Home, MessageCircle, HeartHandshake, Bell, Settings } from "lucide-react-native";
import { doodleHeaderOptions } from "../../../src/lib/theme";
import { DoodleTabBar } from "../../../src/components/DoodleTabBar";
import { useEffect, useState } from "react";
import { getUnreadCount } from "@mingle/client-core";

/**
 * Floating doodle tab bar (shown once the user is past onboarding). Rendering is
 * fully delegated to DoodleTabBar — a hand-drawn WobbleBox floating above the
 * bottom edge; Lucide outline icons, active = colors.accent, inactive = colors.grayMid.
 */
export default function TabsLayout() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      getUnreadCount()
        .then(({ unreadCount: count }) => {
          if (mounted) setUnreadCount(count);
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <Tabs
      tabBar={(props) => <DoodleTabBar {...props} />}
      screenOptions={{
        ...doodleHeaderOptions,
        // 상단 헤더 영역 제거 — 탭 화면은 하단 탭 바가 이미 각 화면을 라벨링한다.
        headerShown: false,
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
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
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
