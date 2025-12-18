import {
  Box,
  ButtonText,
  Button as GluestackButton,
  Text as GluestackText,
  Heading,
  HStack,
} from "@gluestack-ui/themed";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { generateSam3dObject, segmentWithSam2 } from "./lib/api";
import { setGifData } from "./lib/gifCache";
import { uriToResizedBase64 } from "./lib/image";

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
      console.log("Full mask base64:", result.mask);

      if (result.success) {
        // Update accumulated points for next tap
        setTapPositions(allPositions);
        const maskDataUri = `data:image/png;base64,${result.mask}`;
        setMaskImage(maskDataUri);
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
        onProgress: (progress: number, status: string) => {
          setGeneration3dProgress(progress);
          console.log(`Progress: ${progress}% - ${status}`);
        },
      });

      if (!result.success) {
        throw new Error(result.error ?? "Failed to generate 3D object");
      }

      console.log("=== 3D Generation Result ===");
      console.log("Result keys:", Object.keys(result));
      console.log("gif_b64 first 50 chars:", result.gif_b64?.substring(0, 50));

      const gifB64 = result.gif_b64;

      if (!gifB64) {
        throw new Error("No GIF data in response");
      }

      console.log("GIF size:", gifB64.length ?? "null");
      console.log("Storing GIF in cache and navigating to viewer...");

      // Store GIF data in cache (avoids route param size limits)
      // Using empty string for first parameter (backwards compatible with old PLY logic)
      setGifData(gifB64);
      console.log("Data stored in cache");

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

  const handleGenerate3dFinal = async () => {
    // This is an alternative path - currently not used
    // Kept for reference but handleGenerate3d is the active flow
    return;
  };

  if (!uri) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Text className="text-base text-foreground">
          No image URI provided.
        </Text>
      </View>
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
            Segment Object
          </Heading>
        </HStack>

        {/* Instructions */}
        <Box px="$6" py="$4">
          <GluestackText color="#94a3b8" textAlign="center" fontSize="$sm">
            Tap multiple points on the object
          </GluestackText>
        </Box>

        {/* Reset and Point Counter */}
        <HStack px="$6" pb="$4" space="sm" alignItems="center">
          <GluestackButton
            bg="#ef4444"
            onPress={handleReset}
            disabled={tapPositions.length === 0}
            borderRadius="$lg"
            h={40}
            sx={{
              ":pressed": {
                bg: "#dc2626",
              },
              ":disabled": {
                bg: "#6b7280",
              },
            }}
          >
            <HStack space="sm" alignItems="center">
              <Trash2 size={16} color="white" />
              <ButtonText color="white" fontWeight="$semibold" fontSize="$sm">
                Reset
              </ButtonText>
            </HStack>
          </GluestackButton>
          <GluestackText
            color="#64748b"
            fontSize="$sm"
            flex={1}
            textAlign="center"
          >
            {tapPositions.length} point(s)
          </GluestackText>
        </HStack>

        {/* Image Container */}
        <Box px="$6" flex={1} mb="$4">
          <Pressable
            onPress={handleTap}
            style={{
              flex: 1,
              borderRadius: 12,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "#1e3a8a",
            }}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              console.log("Container size:", { width, height });
              setContainerSize({ width, height });
            }}
          >
            {/* Original image - always show this as base */}
            <Image
              source={{ uri }}
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "#0f172a",
              }}
              resizeMode="contain"
            />

            {/* Segmentation mask overlay */}
            {maskImage && (
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
              >
                <Image
                  source={{ uri: maskImage }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />
              </View>
            )}

            {/* Loading indicator */}
            {maskLoading && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "rgba(0,0,0,0.3)",
                  },
                ]}
                pointerEvents="none"
              >
                <ActivityIndicator size="large" color="white" />
              </View>
            )}

            {/* Multiple tap markers */}
            {tapPositions.map((pos, index) => (
              <View
                key={index}
                style={{
                  position: "absolute",
                  left: pos.x - 10,
                  top: pos.y - 10,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: "white",
                  backgroundColor: "rgba(59, 130, 246, 0.65)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                pointerEvents="none"
              >
                <Text
                  style={{ color: "white", fontSize: 10, fontWeight: "bold" }}
                >
                  {index + 1}
                </Text>
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
        </Box>

        {/* Generate Button */}
        <Box px="$6" pb="$6">
          <GluestackButton
            w="$full"
            bg={maskImage ? "#334155" : "#1e293b"}
            onPress={handleGenerate3d}
            disabled={generating3d || !maskImage}
            borderRadius="$xl"
            h={56}
            borderWidth={1}
            borderColor={maskImage ? "#475569" : "#334155"}
            sx={{
              ":pressed": {
                bg: "#0f172a",
              },
            }}
          >
            {generating3d ? (
              <HStack space="md" alignItems="center">
                <ActivityIndicator color="#cbd5e1" />
                <ButtonText color="#cbd5e1" fontWeight="$semibold">
                  Generating...{" "}
                  {generation3dProgress > 0 ? `${generation3dProgress}%` : ""}
                </ButtonText>
              </HStack>
            ) : (
              <ButtonText
                color={maskImage ? "#e2e8f0" : "#64748b"}
                fontWeight="$semibold"
              >
                {maskImage ? "Generate 3D Object" : "Tap to segment first"}
              </ButtonText>
            )}
          </GluestackButton>
        </Box>
      </SafeAreaView>
    </Box>
  );
}
