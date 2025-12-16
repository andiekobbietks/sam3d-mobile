import { Stack } from "expo-router";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "SAM3D" }} />
      <Stack.Screen name="segment" options={{ title: "Pick a point" }} />
      <Stack.Screen name="viewer" options={{ title: "3D Preview" }} />
    </Stack>
  );
}
