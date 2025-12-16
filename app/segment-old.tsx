import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { uriToResizedBase64 } from "./lib/image";
import { pollSam3dJob, segmentWithSam2, submitSam3dJob } from "./lib/runpod";

type Point = { x: number; y: number }; // normalized 0..1

export default function SegmentScreen() {
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri: string }>();

  const [viewSize, setViewSize] = useState<{ w: number; h: number } | null>(
    null
  );
  const [imageBounds, setImageBounds] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [loading, setLoading] = useState(false);
  const [maskLoading, setMaskLoading] = useState(false);
  const [maskImage, setMaskImage] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const markerStyle = useMemo(() => {
    if (!point || !viewSize || !imageDimensions) return null;

    // Recalculate image bounds from current viewSize and imageDimensions
    const imageAspectRatio = imageDimensions.width / imageDimensions.height;
    const viewAspectRatio = viewSize.w / viewSize.h;

    let imgWidth = viewSize.w;
    let imgHeight = viewSize.h;
    let imgX = 0;
    let imgY = 0;

    if (imageAspectRatio > viewAspectRatio) {
      imgHeight = viewSize.w / imageAspectRatio;
      imgY = (viewSize.h - imgHeight) / 2;
    } else {
      imgWidth = viewSize.h * imageAspectRatio;
      imgX = (viewSize.w - imgWidth) / 2;
    }

    const markerLeft = imgX + point.x * imgWidth;
    const markerTop = imgY + point.y * imgHeight;

    console.log("=== MARKER STYLE DEBUG ===");
    console.log("viewSize:", viewSize);
    console.log("imageDimensions:", imageDimensions);
    console.log("imageAspectRatio:", imageAspectRatio);
    console.log("viewAspectRatio:", viewAspectRatio);
    console.log("imgBounds:", { imgX, imgY, imgWidth, imgHeight });
    console.log("normalizedPoint:", point);
    console.log("markerPosition:", { left: markerLeft, top: markerTop });

    return {
      left: markerLeft - 10,
      top: markerTop - 10,
    };
  }, [point, viewSize, imageDimensions]);

  // For debug boxes
  const debugBounds = useMemo(() => {
    if (!viewSize || !imageDimensions) return null;

    const imageAspectRatio = imageDimensions.width / imageDimensions.height;
    const viewAspectRatio = viewSize.w / viewSize.h;

    let imgWidth = viewSize.w;
    let imgHeight = viewSize.h;
    let imgX = 0;
    let imgY = 0;

    if (imageAspectRatio > viewAspectRatio) {
      imgHeight = viewSize.w / imageAspectRatio;
      imgY = (viewSize.h - imgHeight) / 2;
    } else {
      imgWidth = viewSize.h * imageAspectRatio;
      imgX = (viewSize.w - imgWidth) / 2;
    }

    return { imgX, imgY, imgWidth, imgHeight };
  }, [viewSize, imageDimensions]);

  const onImageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewSize({ w: width, h: height });
  };

  const onTap = async (evt: any) => {
    if (!viewSize) return;
    const { locationX, locationY } = evt.nativeEvent;

    console.log("=== TAP DEBUG ===");
    console.log("tap coordinates:", { locationX, locationY });
    console.log("viewSize:", viewSize);

    // Get original image dimensions to calculate actual image bounds in the view
    const dimensions = await getImageDimensions(uri);
    setImageDimensions(dimensions);
    const imageAspectRatio = dimensions.width / dimensions.height;
    const viewAspectRatio = viewSize.w / viewSize.h;

    // Calculate the actual dimensions and position of the image in the view
    let imgWidth = viewSize.w;
    let imgHeight = viewSize.h;
    let imgX = 0;
    let imgY = 0;

    if (imageAspectRatio > viewAspectRatio) {
      // Image is wider - height is constrained, width fills view
      imgHeight = viewSize.w / imageAspectRatio;
      imgY = (viewSize.h - imgHeight) / 2;
    } else {
      // Image is taller - width is constrained, height fills view
      imgWidth = viewSize.h * imageAspectRatio;
      imgX = (viewSize.w - imgWidth) / 2;
    }

    console.log("imageBounds:", { imgX, imgY, imgWidth, imgHeight });

    // Convert tap coordinates to image coordinates
    const tapX = locationX - imgX;
    const tapY = locationY - imgY;

    console.log("tapCoordinatesRelativeToImage:", { tapX, tapY });
    console.log("tapCheck - is tap inside image?", {
      insideX: tapX >= 0 && tapX <= imgWidth,
      insideY: tapY >= 0 && tapY <= imgHeight,
    });

    // Normalize to 0..1 within the image bounds
    const normalizedPoint = {
      x: tapX / imgWidth,
      y: tapY / imgHeight,
    };

    console.log("normalizedPoint:", normalizedPoint);

    // Calculate where marker will appear
    const markerScreenX = imgX + normalizedPoint.x * imgWidth;
    const markerScreenY = imgY + normalizedPoint.y * imgHeight;
    console.log("markerWillAppearAt:", { markerScreenX, markerScreenY });
    console.log("tapWasAt:", { locationX, locationY });
    console.log("markerOffset:", {
      diffX: markerScreenX - locationX,
      diffY: markerScreenY - locationY,
    });

    // Clamp to valid range
    if (
      normalizedPoint.x < 0 ||
      normalizedPoint.x > 1 ||
      normalizedPoint.y < 0 ||
      normalizedPoint.y > 1
    ) {
      Alert.alert("Invalid tap", "Please tap on the image");
      return;
    }

    setPoint(normalizedPoint);

    // Immediately fetch and show the segmentation mask
    if (!uri) return;
    try {
      setMaskLoading(true);
      const image_b64 = await uriToResizedBase64(uri);

      console.log("base64Image length:", image_b64.length);

      // SAM 3 expects pixel coordinates in the resized image (1024 width)
      // The image is resized to 1024 width in uriToResizedBase64
      const scaleFactor = 1024 / dimensions.width;
      const resizedWidth = 1024;
      const resizedHeight = dimensions.height * scaleFactor;
      const pixelX = normalizedPoint.x * resizedWidth;
      const pixelY = normalizedPoint.y * resizedHeight;

      console.log("apiRequest:", {
        pixelX,
        pixelY,
        resizedWidth,
        resizedHeight,
        scaleFactor,
      });

      const result = await segmentWithSam2({
        image_b64,
        x: pixelX,
        y: pixelY,
      });

      if (result.success && result.mask) {
        setMaskImage(`data:image/png;base64,${result.mask}`);
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

  const submit = async () => {
    if (!uri) return;
    if (!point) {
      Alert.alert(
        "Tap the object",
        "Pick a point on the object you want to turn into 3D."
      );
      return;
    }

    try {
      setLoading(true);

      const image_b64 = await uriToResizedBase64(uri);
      const jobId = await submitSam3dJob({ image_b64, point });
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
      <Text style={styles.help}>Tap the object. Then submit.</Text>

      <Pressable
        onPress={onTap}
        style={styles.imageWrap}
        onLayout={onImageLayout}
      >
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        {maskImage && (
          <Image
            source={{ uri: maskImage }}
            style={[styles.image, styles.maskOverlay]}
            resizeMode="contain"
            pointerEvents="none"
          />
        )}
        {maskLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="white" />
          </View>
        )}
        {markerStyle && <View style={[styles.marker, markerStyle]} />}

        {/* Red box - clickable image area */}
        {debugBounds && (
          <View
            style={{
              position: "absolute",
              left: debugBounds.imgX,
              top: debugBounds.imgY,
              width: debugBounds.imgWidth,
              height: debugBounds.imgHeight,
              borderWidth: 3,
              borderColor: "red",
            }}
            pointerEvents="none"
          />
        )}

        {/* Green box - mask area (same as red for now) */}
        {maskImage && debugBounds && (
          <View
            style={{
              position: "absolute",
              left: debugBounds.imgX,
              top: debugBounds.imgY,
              width: debugBounds.imgWidth,
              height: debugBounds.imgHeight,
              borderWidth: 3,
              borderColor: "green",
            }}
            pointerEvents="none"
          />
        )}
      </Pressable>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={submit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.buttonText}>Submit to RunPod</Text>
        )}
      </Pressable>
    </View>
  );
}

async function getImageDimensions(
  uri: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  help: { fontSize: 16, textAlign: "center" },
  imageWrap: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#111",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  maskOverlay: {
    position: "absolute",
    opacity: 0.6,
  },
  loadingOverlay: {
    position: "absolute",
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
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#1b6ef3",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "white", fontWeight: "700" },
});
