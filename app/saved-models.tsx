import {
  Box,
  ButtonText,
  Button as GluestackButton,
  Text as GluestackText,
  Heading,
  HStack,
  VStack,
} from "@gluestack-ui/themed";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
} from "react-native";
import { setGifData } from "./lib/gifCache";
import {
  deleteAllGifFiles,
  deleteGifFile,
  getGifFiles,
  getTotalStorageSize,
  GifFile,
  readGifFile,
} from "./lib/gifStorage";

export default function SavedModelsScreen() {
  const router = useRouter();
  const [models, setModels] = useState<GifFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSize, setTotalSize] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      loadModels();
    }, [])
  );

  const loadModels = async () => {
    setLoading(true);
    try {
      const files = await getGifFiles();
      setModels(files);

      const size = await getTotalStorageSize();
      setTotalSize(size);

      console.log(`[SavedModels] Loaded ${files.length} models`);
    } catch (err) {
      console.error("[SavedModels] Error loading models:", err);
      Alert.alert("Error", "Failed to load saved models");
    } finally {
      setLoading(false);
    }
  };

  const handleViewModel = async (model: GifFile) => {
    try {
      setLoading(true);
      const data = await readGifFile(model.fileName);
      if (!data) {
        Alert.alert("Error", "Could not read file");
        return;
      }

      // Pass GIF data (don't auto-save since it's already saved)
      setGifData(data, false);
      router.push("/viewer");
    } catch (err) {
      Alert.alert("Error", "Failed to open model");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModel = (model: GifFile) => {
    Alert.alert("Delete Model", `Delete "${model.fileName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const success = await deleteGifFile(model.fileName);
          if (success) {
            loadModels();
          } else {
            Alert.alert("Error", "Failed to delete model");
          }
        },
      },
    ]);
  };

  const handleDeleteAll = () => {
    if (models.length === 0) return;

    Alert.alert(
      "Delete All Models",
      `Delete all ${models.length} saved models?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            const success = await deleteAllGifFiles();
            if (success) {
              loadModels();
            } else {
              Alert.alert("Error", "Failed to delete models");
            }
          },
        },
      ]
    );
  };

  if (loading && models.length === 0) {
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
            <GluestackText color="#94a3b8">Loading models...</GluestackText>
          </VStack>
        </SafeAreaView>
      </Box>
    );
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
          <Pressable onPress={() => router.back()}>
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
            Saved Models
          </Heading>
        </HStack>

        {/* Stats */}
        <HStack px="$6" py="$4" space="md">
          <VStack flex={1} space="xs">
            <GluestackText color="#94a3b8" fontSize="$xs">
              Models
            </GluestackText>
            <GluestackText color="$white" fontSize="$lg" fontWeight="$bold">
              {models.length}
            </GluestackText>
          </VStack>
          <VStack flex={1} space="xs">
            <GluestackText color="#94a3b8" fontSize="$xs">
              Storage
            </GluestackText>
            <GluestackText color="$white" fontSize="$lg" fontWeight="$bold">
              {(totalSize / 1024 / 1024).toFixed(1)} MB
            </GluestackText>
          </VStack>
        </HStack>

        {/* Content Area */}
        <VStack flex={1} px="$6" pt="$4" space="md">
          {models.length === 0 ? (
            <VStack
              flex={1}
              justifyContent="center"
              alignItems="center"
              space="md"
            >
              <GluestackText
                color="#94a3b8"
                fontSize="$lg"
                fontWeight="$semibold"
              >
                No Saved Models
              </GluestackText>
              <GluestackText color="#64748b" fontSize="$sm" textAlign="center">
                Generate a 3D model to save it here
              </GluestackText>
            </VStack>
          ) : (
            <FlatList
              data={models}
              keyExtractor={(item) => item.fileName}
              scrollEnabled={true}
              renderItem={({ item }) => (
                <Pressable
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    marginBottom: 8,
                    backgroundColor: "#1e293b",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#334155",
                  }}
                  onPress={() => handleViewModel(item)}
                >
                  <Image
                    source={{ uri: `data:image/gif;base64,${item.fileName}` }}
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 8,
                      marginRight: 12,
                      backgroundColor: "#0f172a",
                    }}
                  />
                  <VStack flex={1} space="xs">
                    <Text
                      style={{
                        color: "#e2e8f0",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                      numberOfLines={1}
                    >
                      {item.fileName}
                    </Text>
                    <Text style={{ color: "#94a3b8", fontSize: 12 }}>
                      {(item.fileSize / 1024 / 1024).toFixed(2)} MB •{" "}
                      {item.createdDate}
                    </Text>
                  </VStack>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteModel(item);
                    }}
                    style={{ padding: 8 }}
                  >
                    <Trash2 size={20} color="#ef4444" />
                  </Pressable>
                </Pressable>
              )}
            />
          )}
        </VStack>

        {/* Delete All Button */}
        {models.length > 0 && (
          <Box px="$6" pb="$6">
            <GluestackButton
              w="$full"
              bg="#ef4444"
              onPress={handleDeleteAll}
              borderRadius="$xl"
              h={48}
              sx={{
                ":pressed": {
                  bg: "#dc2626",
                },
              }}
            >
              <ButtonText color="white" fontWeight="$semibold">
                Delete All Models
              </ButtonText>
            </GluestackButton>
          </Box>
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
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#888",
    fontSize: 14,
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    marginTop: 48,
  },
  backButton: {
    color: "#1b6ef3",
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  placeholder: {
    width: 50,
  },
  stats: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  stat: {
    flex: 1,
    backgroundColor: "rgba(27,110,243,0.1)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statLabel: {
    color: "#888",
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  modelCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 12,
  },
  thumbnailContainer: {
    width: 60,
    height: 60,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  modelDetails: {
    color: "#888",
    fontSize: 12,
  },
  deleteModelButton: {
    padding: 8,
  },
  deleteIcon: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyText: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 8,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteAllButton: {
    backgroundColor: "rgba(239,68,68,0.7)",
  },
  actionButtonText: {
    color: "white",
    fontWeight: "600",
  },
});
