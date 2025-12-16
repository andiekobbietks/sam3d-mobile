import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { uriToResizedBase64 } from "./lib/image";
import { setPlyData } from "./lib/plyCache";
import { generateSam3dObject, segmentWithSam2 } from "./lib/runpod";

// The image is resized to this width in uriToResizedBase64
const RESIZED_IMAGE_WIDTH = 1024;

export default function SegmentScreen() {
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri: string }>();

  // Original image dimensions (before resize)
  const [originalSize, setOriginalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Container size (the Pressable that holds the image)
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Multiple tap positions for multi-point segmentation
  const [tapPositions, setTapPositions] = useState<
    Array<{ x: number; y: number }>
  >([]);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [maskLoading, setMaskLoading] = useState(false);
  const [generating3d, setGenerating3d] = useState(false);
  const [generation3dProgress, setGeneration3dProgress] = useState(0);

  // Segmentation mask from API
  const [maskImage, setMaskImage] = useState<string | null>(null);

  // Load original image dimensions on mount
  useEffect(() => {
    if (uri) {
      Image.getSize(
        uri,
        (width, height) => {
          console.log("Original image size:", { width, height });
          setOriginalSize({ width, height });
        },
        (error) => console.error("Failed to get image size:", error)
      );
    }
  }, [uri]);

  // Calculate where the image actually renders within the container (for resizeMode="contain")
  const getImageBounds = () => {
    if (!containerSize || !originalSize) return null;

    const containerAspect = containerSize.width / containerSize.height;
    const imageAspect = originalSize.width / originalSize.height;

    let imageWidth: number;
    let imageHeight: number;
    let imageX: number;
    let imageY: number;

    if (imageAspect > containerAspect) {
      // Image is wider than container - width fills, height is centered
      imageWidth = containerSize.width;
      imageHeight = containerSize.width / imageAspect;
      imageX = 0;
      imageY = (containerSize.height - imageHeight) / 2;
    } else {
      // Image is taller than container - height fills, width is centered
      imageHeight = containerSize.height;
      imageWidth = containerSize.height * imageAspect;
      imageX = (containerSize.width - imageWidth) / 2;
      imageY = 0;
    }

    return { imageX, imageY, imageWidth, imageHeight };
  };

  const imageBounds = getImageBounds();

  const handleTap = async (event: any) => {
    const { locationX, locationY } = event.nativeEvent;

    if (!imageBounds || !originalSize || !uri) {
      console.log("Missing data:", { imageBounds, originalSize, uri });
      return;
    }

    const { imageX, imageY, imageWidth, imageHeight } = imageBounds;

    // Check if tap is within the image bounds
    const isInsideImage =
      locationX >= imageX &&
      locationX <= imageX + imageWidth &&
      locationY >= imageY &&
      locationY <= imageY + imageHeight;

    if (!isInsideImage) {
      Alert.alert("Invalid tap", "Please tap inside the image");
      return;
    }

    // Add tap position to array for multi-point segmentation
    setTapPositions([...tapPositions, { x: locationX, y: locationY }]);

    // Convert screen tap to position within the displayed image (0 to imageWidth/Height)
    const tapInImageX = locationX - imageX;
    const tapInImageY = locationY - imageY;

    // Convert to normalized coordinates (0 to 1)
    const normalizedX = tapInImageX / imageWidth;
    const normalizedY = tapInImageY / imageHeight;

    // Calculate pixel coordinates for the resized image sent to API
    // The API receives an image resized to RESIZED_IMAGE_WIDTH
    const resizedHeight =
      (originalSize.height / originalSize.width) * RESIZED_IMAGE_WIDTH;
    const apiX = normalizedX * RESIZED_IMAGE_WIDTH;
    const apiY = normalizedY * resizedHeight;

    console.log("=== TAP DEBUG ===");
    console.log("Screen tap:", { locationX, locationY });
    console.log("Image bounds:", imageBounds);
    console.log("Tap in image:", { tapInImageX, tapInImageY });
    console.log("Normalized:", { normalizedX, normalizedY });
    console.log("API coordinates:", {
      apiX,
      apiY,
      resizedWidth: RESIZED_IMAGE_WIDTH,
      resizedHeight,
    });

    // Call segmentation API with all points
    try {
      setMaskLoading(true);
      setMaskImage(null);

      const image_b64 = await uriToResizedBase64(uri);

      // Convert all tap positions (including new tap) to API coordinates
      const allPositions = [...tapPositions, { x: locationX, y: locationY }];
      const apiPoints = allPositions.map((pos) => {
        const tapInImageX = pos.x - imageX;
        const tapInImageY = pos.y - imageY;
        const normalizedX = tapInImageX / imageWidth;
        const normalizedY = tapInImageY / imageHeight;
        const resizedHeight =
          (originalSize.height / originalSize.width) * RESIZED_IMAGE_WIDTH;
        return {
          x: normalizedX * RESIZED_IMAGE_WIDTH,
          y: normalizedY * resizedHeight,
        };
      });

      console.log("Sending to API:", {
        points: apiPoints,
        count: apiPoints.length,
        hasPreviousMask: !!maskImage,
      });

      // Extract base64 from data URI if there's a previous mask
      const previousMaskBase64 = maskImage?.split(",")[1];

      console.log("=== MASK DEBUG ===");
      console.log("Previous mask URI prefix:", maskImage?.substring(0, 50));
      console.log("Previous mask base64 length:", previousMaskBase64?.length);
      console.log("Previous mask being sent:", !!previousMaskBase64);

      const result = await segmentWithSam2({
        image_b64,
        points: apiPoints,
        previous_mask: previousMaskBase64,
      });

      console.log("=== API RESPONSE ===");
      console.log("Result:", { success: result.success, score: result.score });
      console.log("New mask base64 length:", result.mask?.length);

      if (result.success) {
        // Update accumulated points for next tap
        setTapPositions(allPositions);
        setMaskImage(`data:image/png;base64,${result.mask}`);
        console.log("Segmentation successful with score:", result.score);
      }
    } catch (e: any) {
      console.error("Segmentation error:", e);
      Alert.alert(
        "Segmentation Error",
        e?.message ?? "Failed to segment image"
      );
    } finally {
      setMaskLoading(false);
    }
  };

  const handleReset = () => {
    setTapPositions([]);
    setMaskImage(null);
  };

  const handleGenerate3d = async () => {
    if (!uri || !maskImage) {
      Alert.alert("No mask", "Please segment the object first");
      return;
    }

    try {
      setGenerating3d(true);
      setGeneration3dProgress(0);

      const image_b64 = await uriToResizedBase64(uri);
      // Extract base64 from data URI
      const mask_b64 = maskImage.split(",")[1];

      console.log("=== 3D GENERATION ===");
      console.log("Starting 3D generation with polling...");
      console.log("Image base64 length:", image_b64.length);
      console.log("Mask base64 length:", mask_b64.length);

      const result = await generateSam3dObject({
        image_b64,
        mask_b64,
        seed: 42,
        onProgress: (progress, status) => {
          setGeneration3dProgress(progress);
          console.log(`Progress: ${progress}% - ${status}`);
        },
      });

      if (!result.success) {
        throw new Error(result.error ?? "Failed to generate 3D object");
      }

      // Use PLY base64 data directly
      if (!result.ply_b64) {
        throw new Error("No PLY data in response");
      }

      console.log("Storing PLY data in cache and navigating to viewer...");
      // Store PLY data in cache (avoids route param size limits)
      setPlyData(result.ply_b64);

      // Navigate to viewer
      router.push("/viewer");
    } catch (e: any) {
      console.error("3D generation error:", e);
      Alert.alert("Generation Failed", e?.message ?? "Unknown error");
    } finally {
      setGenerating3d(false);
      setGeneration3dProgress(0);
    }
  };

  const handleSubmit = async () => {
    if (!uri || tapPositions.length === 0 || !imageBounds || !originalSize) {
      Alert.alert(
        "Add points to object",
        "Tap one or more points on the object you want to turn into 3D."
      );
      return;
    }

    const { imageX, imageY, imageWidth, imageHeight } = imageBounds;
    // Use the last tapped point as the primary point for 3D generation
    const lastPos = tapPositions[tapPositions.length - 1];
    const normalizedX = (lastPos.x - imageX) / imageWidth;
    const normalizedY = (lastPos.y - imageY) / imageHeight;

    try {
      setLoading(true);

      const image_b64 = await uriToResizedBase64(uri);
      const jobId = await submitSam3dJob({
        image_b64,
        point: { x: normalizedX, y: normalizedY },
      });
      const output = await pollSam3dJob(jobId);

      const modelUrl = (output as any)?.model_url;
      if (!modelUrl) throw new Error("No model_url in output");

      router.push({ pathname: "/viewer", params: { modelUrl } });
    } catch (e: any) {
      Alert.alert("Failed", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (!uri) {
    return (
      <View style={styles.container}>
        <Text>No image URI provided.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.help}>
        Tap multiple points on the object. Then submit.
      </Text>

      <View style={styles.controlRow}>
        <Pressable
          style={[styles.button, styles.resetButton]}
          onPress={handleReset}
          disabled={tapPositions.length === 0}
        >
          <Text style={styles.buttonText}>Reset Points</Text>
        </Pressable>
        <Text style={styles.pointCount}>{tapPositions.length} point(s)</Text>
      </View>

      <Pressable
        onPress={handleTap}
        style={styles.imageContainer}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          console.log("Container size:", { width, height });
          setContainerSize({ width, height });
        }}
      >
        {/* Original image - always show this as base */}
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />

        {/* Segmentation mask overlay */}
        {maskImage && (
          <Image
            source={{ uri: maskImage }}
            style={[styles.image, styles.maskOverlay]}
            resizeMode="contain"
            pointerEvents="none"
          />
        )}

        {/* Loading indicator */}
        {maskLoading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="white" />
          </View>
        )}

        {/* Multiple tap markers */}
        {tapPositions.map((pos, index) => (
          <View
            key={index}
            style={[
              styles.marker,
              {
                left: pos.x - 10,
                top: pos.y - 10,
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.markerNumber}>{index + 1}</Text>
          </View>
        ))}

        {/* Debug: Red border around calculated image bounds */}
        {imageBounds && (
          <View
            style={{
              position: "absolute",
              left: imageBounds.imageX,
              top: imageBounds.imageY,
              width: imageBounds.imageWidth,
              height: imageBounds.imageHeight,
              borderWidth: 1,
              borderColor: "rgba(255,0,0,0.3)",
            }}
            pointerEvents="none"
          />
        )}
      </Pressable>

      <Pressable
        style={[styles.button, generating3d && styles.buttonDisabled]}
        onPress={handleGenerate3d}
        disabled={generating3d || !maskImage}
      >
        {generating3d ? (
          <View style={styles.progressContainer}>
            <ActivityIndicator color="white" />
            <Text style={styles.progressText}>
              Generating 3D...
              {generation3dProgress > 0 ? ` ${generation3dProgress}%` : ""}
            </Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>
            {maskImage ? "Generate 3D Object" : "Tap to segment first"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  help: {
    fontSize: 16,
    textAlign: "center",
  },
  imageContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  processedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    opacity: 0.4,
  },
  maskOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    opacity: 0.5, // Blend mask with original image for lighter exposure effect
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  marker: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "white",
    backgroundColor: "rgba(27,110,243,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  markerNumber: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  controlRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  resetButton: {
    flex: 1,
    backgroundColor: "#ef4444",
  },
  pointCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#1b6ef3",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontWeight: "700",
  },
  progressContainer: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  progressText: {
    color: "white",
    fontWeight: "600",
  },
});
