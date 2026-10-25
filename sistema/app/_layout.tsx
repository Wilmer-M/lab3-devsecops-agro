// app/_layout.tsx
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { DataProvider } from "../context/dataContext";
import { HistoryProvider } from "../context/historyContext";
import { AuthProvider } from "../context/authContext";
import { NotificationProvider } from "../context/notificationContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <NotificationProvider>
      <AuthProvider>
        <HistoryProvider>
          <DataProvider>
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
              </Stack>

              <StatusBar
                translucent
                backgroundColor="transparent"
                style={colorScheme === "dark" ? "light" : "dark"}
              />
            </ThemeProvider>
          </DataProvider>
        </HistoryProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}
