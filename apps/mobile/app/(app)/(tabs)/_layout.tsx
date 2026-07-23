import { Tabs } from "expo-router";
import { Home, MessageCircle, MapPin, Settings } from "lucide-react-native";
import { doodleHeaderOptions } from "../../../src/lib/theme";
import { DoodleTabBar } from "../../../src/components/DoodleTabBar";

/**
 * Bottom tab bar (icon-only), shown once the user is past onboarding. Four tabs:
 * 홈 · 채팅 · 네이버예약 · 설정. Proposals and notifications keep their routes (reachable from the
 * home hub) but are hidden from the bar via `href: null`.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <DoodleTabBar {...props} />}
      screenOptions={{ ...doodleHeaderOptions, headerShown: false }}
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
        name="naver-reserve"
        options={{
          title: "네이버 예약",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={2} />,
        }}
      />
      {/* Kept as routes (home hub links here) but hidden from the bar. */}
      <Tabs.Screen name="proposals" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
