import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/typography";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontFamily: FONTS.sansMedium,
          fontSize: 10,
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 82,
          paddingBottom: 20,
          paddingTop: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: "Gardırobum",
          tabBarIcon: ({ color }) => (
            <Ionicons name="shirt-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="outfit"
        options={{
          title: "Kombin Analiz",
          tabBarIcon: ({ color }) => (
            <Ionicons name="sparkles-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Sosyal",
          tabBarIcon: ({ color }) => (
            <Ionicons name="people-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={22} color={color} />
          ),
        }}
      />
      {/* analytics is kept but not shown in tab bar */}
      <Tabs.Screen
        name="analytics"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
