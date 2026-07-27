import { Tabs } from "expo-router";
import { Home, MessageCircle, MapPin, Settings } from "lucide-react-native";
import { dark, doodleHeaderOptions } from "../../../src/lib/theme";
import { DoodleTabBar } from "../../../src/components/DoodleTabBar";

/**
 * Bottom tab bar (icon-only), shown once the user is past onboarding. Four tabs:
 * 홈 · 채팅 · 네이버예약 · 설정. 프로포즈·알림은 페이지가 아니라 홈의 투명 팝업(ProposalsPopup·
 * NotificationsPopup)으로 열린다.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <DoodleTabBar {...props} />}
      screenOptions={{
        ...doodleHeaderOptions,
        headerShown: false,
        // 탭 전환 틈에 라이트 배경이 비치지 않게 다크 고정(전 화면 다크).
        sceneStyle: { backgroundColor: dark.bg },
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
    </Tabs>
  );
}
