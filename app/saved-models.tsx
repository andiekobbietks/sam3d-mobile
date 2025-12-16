import { useFocusEffect, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { setPlyData } from "./lib/plyCache";
import {
  deleteAllPlyFiles,
  deletePlyFile,
  getPlyFiles,
  getTotalStorageSize,
  PlyFile,
  readPlyFile,
} from "./lib/plyStorage";

export default function SavedModelsScreen() {
  const router = useRouter();
  const [models, setModels] = useState<PlyFile[]>([]);
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
      const files = await getPlyFiles();
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

  const handleViewModel = async (model: PlyFile) => {
    try {
      setLoading(true);
      const data = await readPlyFile(model.fileName);
      if (!data) {
        Alert.alert("Error", "Could not read file");
        return;
      }

      // Pass autoSave=false since this is an existing saved file
      setPlyData(data, false);
      router.push("/viewer");
    } catch (err) {
      Alert.alert("Error", "Failed to open model");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModel = (model: PlyFile) => {
    Alert.alert("Delete Model", `Delete "${model.fileName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const success = await deletePlyFile(model.fileName);
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
            const success = await deleteAllPlyFiles();
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
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#1b6ef3" />
          <Text style={styles.loadingText}>Loading models...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Saved Models</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Models</Text>
          <Text style={styles.statValue}>{models.length}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Storage</Text>
          <Text style={styles.statValue}>
            {(totalSize / 1024 / 1024).toFixed(1)} MB
          </Text>
        </View>
      </View>

      {models.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No Saved Models</Text>
          <Text style={styles.emptyText}>
            Generate a 3D model to save it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={models}
          keyExtractor={(item) => item.fileName}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.modelCard}>
              <Pressable
                style={styles.modelContent}
                onPress={() => handleViewModel(item)}
              >
                <View style={styles.modelInfo}>
                  <Text style={styles.modelName} numberOfLines={1}>
                    {item.fileName}
                  </Text>
                  <Text style={styles.modelDetails}>
                    {(item.fileSize / 1024 / 1024).toFixed(2)} MB •{" "}
                    {item.createdDate}
                  </Text>
                </View>
                <Text style={styles.openIcon}>→</Text>
              </Pressable>
              <Pressable
                style={styles.deleteModelButton}
                onPress={() => handleDeleteModel(item)}
              >
                <Text style={styles.deleteIcon}>🗑</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      {/* Footer Actions */}
      {models.length > 0 && (
        <View style={styles.footer}>
          <Pressable
            style={[styles.actionButton, styles.deleteAllButton]}
            onPress={handleDeleteAll}
          >
            <Text style={styles.actionButtonText}>Delete All Models</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  backButton: {
    color: "#1b6ef3",
    fontWeight: "600",
    fontSize: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  placeholder: {
    width: 40,
  },
  stats: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 16,
  },
  stat: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#888",
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  modelCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  modelContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  modelDetails: {
    fontSize: 11,
    color: "#888",
    fontFamily: "monospace",
  },
  openIcon: {
    fontSize: 16,
    color: "#1b6ef3",
    marginLeft: 8,
  },
  deleteModelButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,100,100,0.1)",
  },
  deleteIcon: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#888",
  },
  footer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#222",
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteAllButton: {
    backgroundColor: "#4a2a2a",
  },
  actionButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
});
