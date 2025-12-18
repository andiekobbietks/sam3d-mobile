import { config } from "@gluestack-ui/config";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import { Stack } from "expo-router";
import "react-native-reanimated";
import "../global.css";

export default function Layout() {
  return (
    <GluestackUIProvider config={config}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#ffffff",
          },
          headerTintColor: "#1b6ef3",
          headerTitleStyle: {
            fontWeight: "600",
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "SAM 3D Mobile",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="segment"
          options={{
            title: "Segment Object",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="viewer"
          options={{
            title: "3D Preview",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="saved-models"
          options={{
            title: "Saved Models",
            headerShown: false,
          }}
        />
      </Stack>
    </GluestackUIProvider>
  );
}
