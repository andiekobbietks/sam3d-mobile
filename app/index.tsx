import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const router = useRouter();
  const [uri, setUri] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (result.canceled) return;
    const pickedUri = result.assets[0]?.uri;
    if (!pickedUri) return;

    setUri(pickedUri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera permission needed", "Please allow camera access.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
    });

    if (result.canceled) return;
    const pickedUri = result.assets[0]?.uri;
    if (!pickedUri) return;

    setUri(pickedUri);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SAM 3D Mobile</Text>

      <View style={styles.row}>
        <Pressable style={styles.button} onPress={pickImage}>
          <Text style={styles.buttonText}>📸 Pick Image</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={takePhoto}>
          <Text style={styles.buttonText}>📷 Take Photo</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.button, styles.savedButton]}
        onPress={() => router.push("/saved-models")}
      >
        <Text style={styles.buttonText}>📁 View Saved Models</Text>
      </Pressable>

      {!!uri && (
        <>
          <Image source={{ uri }} style={styles.preview} />
          <Pressable
            style={[styles.button, styles.primary]}
            onPress={() =>
              router.push({ pathname: "/segment", params: { uri } })
            }
          >
            <Text style={styles.buttonText}>→ Segment Object</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12, justifyContent: "center" },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
    color: "#fff",
  },
  row: { flexDirection: "row", gap: 12, justifyContent: "center" },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#2a2a2a",
  },
  savedButton: {
    backgroundColor: "#1a3a4a",
    marginVertical: 8,
  },
  primary: { backgroundColor: "#1b6ef3", alignSelf: "center", marginTop: 8 },
  buttonText: { color: "white", fontWeight: "600", fontSize: 14 },
  preview: { width: "100%", height: 320, borderRadius: 12, marginVertical: 8 },
});
