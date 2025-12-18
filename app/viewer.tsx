import {
  Box,
  ButtonText,
  Button as GluestackButton,
  Text as GluestackText,
  Heading,
  HStack,
  VStack,
} from "@gluestack-ui/themed";
import { useRouter } from "expo-router";
import { ArrowLeft, FolderOpen, Trash2 } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
} from "react-native";
import {
  clearGifData,
  getGifData,
  markAsSaved,
  shouldSaveGifData,
} from "./lib/gifCache";
import { GifFile, saveGifFile } from "./lib/gifStorage";

/**
 * 3D Viewer Component for React Native
 * Displays animated GIF of 3D model
 */

export default function ViewerScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gifData, setGifData] = useState<string | null>(null);
  const [savedFile, setSavedFile] = useState<GifFile | null>(null);

  useEffect(() => {
    loadGif();
  }, []);

  const loadGif = async () => {
    try {
      console.log("[Viewer] loadGif starting...");
      const cachedGif = getGifData();

      if (!cachedGif) {
        console.log(
          "[Viewer] No GIF in cache, waiting for user to generate model..."
        );
        setLoading(false);
        return;
      }

      console.log(`[Viewer] Received GIF: ${cachedGif.length} bytes`);

      // Save GIF file if needed
      let savedGif: GifFile | null = null;
      if (shouldSaveGifData()) {
        try {
          savedGif = await saveGifFile(cachedGif);
          markAsSaved();
          console.log(`[Viewer] Saved GIF to: ${savedGif.filePath}`);
        } catch (saveErr) {
          console.error("[Viewer] Failed to save GIF file:", saveErr);
        }
      } else {
        console.log(
          "[Viewer] Viewing existing saved model (no duplicate save)"
        );
      }

      setGifData(cachedGif);
      if (savedGif) {
        setSavedFile(savedGif);
      }
      setLoading(false);
    } catch (err) {
      console.error("[Viewer] Error in loadGif:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  const handleBack = () => {
    clearGifData();
    router.back();
  };

  const handleDelete = async () => {
    if (!savedFile) return;

    Alert.alert("Delete Model", `Delete "${savedFile.fileName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { deleteGifFile } = await import("./lib/gifStorage");
          const success = await deleteGifFile(savedFile.fileName);
          if (success) {
            Alert.alert("Deleted", "Model deleted successfully");
            handleBack();
          } else {
            Alert.alert("Error", "Failed to delete model");
          }
        },
      },
    ]);
  };

  const handleViewSaved = () => {
    router.push("/saved-models");
  };

  if (error) {
    return (
      <Box flex={1} bg="#0a0e27">
        <SafeAreaView style={{ flex: 1 }}>
          <VStack
            flex={1}
            justifyContent="center"
            alignItems="center"
            space="lg"
            px="$6"
          >
            <Heading color="$white" fontSize="$2xl" fontWeight="$bold">
              Error
            </Heading>
            <GluestackText color="#94a3b8" textAlign="center">
              {error}
            </GluestackText>
            <GluestackButton
              bg="#334155"
              onPress={handleBack}
              borderRadius="$xl"
              h={48}
              w="$full"
              sx={{
                ":pressed": {
                  bg: "#0f172a",
                },
              }}
            >
              <ButtonText color="#e2e8f0" fontWeight="$semibold">
                Go Back
              </ButtonText>
            </GluestackButton>
          </VStack>
        </SafeAreaView>
      </Box>
    );
  }

  if (!gifData) {
    console.log(
      "[Viewer] Rendering screen - gifData:",
      !!gifData,
      "loading:",
      loading
    );
    if (loading) {
      return (
        <Box flex={1} bg="#0a0e27">
          <SafeAreaView style={{ flex: 1 }}>
            <VStack
              flex={1}
              justifyContent="center"
              alignItems="center"
              space="md"
            >
              <ActivityIndicator size="large" color="#3b82f6" />
              <GluestackText color="#94a3b8">Loading 3D Model...</GluestackText>
            </VStack>
          </SafeAreaView>
        </Box>
      );
    } else {
      return (
        <Box flex={1} bg="#0a0e27">
          <SafeAreaView style={{ flex: 1 }}>
            <VStack
              flex={1}
              justifyContent="center"
              alignItems="center"
              space="lg"
              px="$6"
            >
              <Heading color="$white" fontSize="$2xl" fontWeight="$bold">
                No Model
              </Heading>
              <GluestackText color="#94a3b8" textAlign="center">
                No 3D model generated. Run segmentation first to generate a
                model.
              </GluestackText>
              <GluestackButton
                bg="#334155"
                onPress={handleBack}
                borderRadius="$xl"
                h={48}
                w="$full"
                sx={{
                  ":pressed": {
                    bg: "#0f172a",
                  },
                }}
              >
                <ButtonText color="#e2e8f0" fontWeight="$semibold">
                  Go Back
                </ButtonText>
              </GluestackButton>
            </VStack>
          </SafeAreaView>
        </Box>
      );
    }
  }

  return (
    <Box flex={1} bg="#0a0e27">
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header with Back Button */}
        <HStack
          px="$6"
          py="$4"
          alignItems="center"
          borderBottomWidth={1}
          borderBottomColor="#1e3a8a"
        >
          <Pressable onPress={handleBack}>
            <ArrowLeft size={24} color="#e2e8f0" />
          </Pressable>
          <Heading
            color="$white"
            fontSize="$2xl"
            fontWeight="$bold"
            flex={1}
            textAlign="center"
            mr="$12"
          >
            3D Preview
          </Heading>
        </HStack>

        {/* GIF Display */}
        <Box
          flex={1}
          justifyContent="center"
          alignItems="center"
          px="$6"
          py="$4"
        >
          <Image
            source={{ uri: `data:image/gif;base64,${gifData}` }}
            resizeMode="contain"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 12,
            }}
          />
        </Box>

        {/* File Info and Actions */}
        {savedFile && (
          <VStack px="$6" pb="$6" space="md">
            <VStack space="xs">
              <GluestackText
                color="#e2e8f0"
                fontSize="$sm"
                fontWeight="$semibold"
              >
                {savedFile.fileName}
              </GluestackText>
              <GluestackText color="#94a3b8" fontSize="$xs">
                {(savedFile.fileSize / 1024 / 1024).toFixed(2)} MB •{" "}
                {savedFile.createdDate}
              </GluestackText>
            </VStack>

            {/* Action Buttons */}
            <HStack space="sm">
              <GluestackButton
                flex={1}
                bg="#334155"
                onPress={handleViewSaved}
                borderRadius="$xl"
                h={48}
                borderWidth={1}
                borderColor="#475569"
                sx={{
                  ":pressed": {
                    bg: "#0f172a",
                  },
                }}
              >
                <HStack space="sm" alignItems="center">
                  <FolderOpen size={18} color="#e2e8f0" />
                  <ButtonText
                    color="#e2e8f0"
                    fontWeight="$semibold"
                    fontSize="$sm"
                  >
                    Saved
                  </ButtonText>
                </HStack>
              </GluestackButton>

              <GluestackButton
                flex={1}
                bg="#ef4444"
                onPress={handleDelete}
                borderRadius="$xl"
                h={48}
                sx={{
                  ":pressed": {
                    bg: "#dc2626",
                  },
                }}
              >
                <HStack space="sm" alignItems="center">
                  <Trash2 size={18} color="white" />
                  <ButtonText
                    color="white"
                    fontWeight="$semibold"
                    fontSize="$sm"
                  >
                    Delete
                  </ButtonText>
                </HStack>
              </GluestackButton>
            </HStack>
          </VStack>
        )}
      </SafeAreaView>
    </Box>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  gifView: {
    flex: 1,
    resizeMode: "contain",
  },
  backButton: {
    position: "absolute",
    top: 48,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    zIndex: 10,
  },
  backButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  toolbar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  fileInfo: {
    marginBottom: 12,
  },
  fileName: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  fileSize: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  toolbarButtons: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  toolbarButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  secondaryButton: {
    backgroundColor: "rgba(27, 110, 243, 0.7)",
  },
  deleteButton: {
    backgroundColor: "rgba(239, 68, 68, 0.7)",
  },
  toolbarButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ef4444",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#888",
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#1b6ef3",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  loadingText: {
    color: "white",
    marginTop: 16,
    fontSize: 14,
  },
});
