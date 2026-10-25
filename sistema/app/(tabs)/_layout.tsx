import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import LoginScreen from "../../components/LoginScreen";
import { useAuth } from "../../context/authContext";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user, loadingSession } = useAuth();

  if (loadingSession) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#eef2f7",
        }}
      >
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const activeColor = "#16a34a";
  const inactiveColor = "#94a3b8";
  const barBgColor = "#ffffff";

  const baseScreenOptions = {
    tabBarActiveTintColor: activeColor,
    tabBarInactiveTintColor: inactiveColor,
    headerShown: false,
    tabBarStyle: {
      backgroundColor: barBgColor,
      borderTopWidth: 1,
      borderTopColor: "#e2e8f0",
      paddingBottom: insets.bottom > 0 ? insets.bottom + 2 : 6,
      height: 54 + (insets.bottom > 0 ? insets.bottom + 2 : 6),
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.04,
      shadowRadius: 16,
      elevation: 4,
    },
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: "700" as const,
      paddingBottom: 2,
    },
    tabBarItemStyle: {
      paddingVertical: 4,
    },
  };

  const superadminTabs = new Set([
    "organizationManagement",
    "activityLog",
    "profile",
  ]);
  const adminTabs = new Set(["farmerManagement", "reports", "profile"]);
  const agricultorTabs = new Set([
    "soilStatus",
    "index",
    "idealCurves",
    "applicationHistory",
    "weatherStation",
    "profile",
  ]);

  const roleTabs =
    user.rol === "superadmin"
      ? superadminTabs
      : user.rol === "admin"
        ? adminTabs
        : agricultorTabs;

  const navKey = `tabs-${user.rol}-${user.id}`;

  const initialTab =
    user.rol === "superadmin"
      ? "organizationManagement"
      : user.rol === "admin"
        ? "farmerManagement"
        : "soilStatus";

  const tabOpts = (
    name: string,
    title: string,
    icon: keyof typeof MaterialIcons.glyphMap,
  ) =>
    roleTabs.has(name)
      ? {
          title,
          tabBarButton: HapticTab,
          tabBarIcon: ({ color }: { color: string }) => (
            <MaterialIcons size={24} name={icon} color={color} />
          ),
        }
      : { title, href: null };

  return (
    <Tabs
      key={navKey}
      screenOptions={baseScreenOptions}
      initialRouteName={initialTab}
    >
      <Tabs.Screen
        name="soilStatus"
        options={tabOpts("soilStatus", "Estado", "analytics")}
      />
      <Tabs.Screen
        name="index"
        options={tabOpts("index", "Monitoreo", "bar-chart")}
      />
      <Tabs.Screen
        name="idealCurves"
        options={tabOpts("idealCurves", "Ideal", "spa")}
      />
      <Tabs.Screen
        name="applicationHistory"
        options={tabOpts("applicationHistory", "Historial", "history")}
      />
      <Tabs.Screen
        name="weatherStation"
        options={tabOpts("weatherStation", "Clima", "wb-sunny")}
      />
      <Tabs.Screen
        name="agriculturalAssistant"
        options={tabOpts("agriculturalAssistant", "Asistente", "psychology")}
      />
      <Tabs.Screen
        name="farmerManagement"
        options={tabOpts("farmerManagement", "Agricultores", "people")}
      />
      <Tabs.Screen
        name="reports"
        options={tabOpts("reports", "Reportes", "folder-shared")}
      />
      <Tabs.Screen
        name="activityLog"
        options={tabOpts("activityLog", "Actividad", "receipt-long")}
      />
      <Tabs.Screen
        name="organizationManagement"
        options={tabOpts(
          "organizationManagement",
          "Organizaciones",
          "apartment",
        )}
      />
      <Tabs.Screen
        name="profile"
        options={tabOpts("profile", "Perfil", "person")}
      />
    </Tabs>
  );
}
