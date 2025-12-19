import {
  Box,
  Button,
  ButtonText,
  Heading,
  HStack,
  Image,
  Spinner,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  ArrowRight,
  Camera,
  FileText,
  ImagePlus,
  Trash2,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HomeScreen = () => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSegmenting, setIsSegmenting] = useState(false);

  const handleGallerySelect = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (result.canceled) return;
    const pickedUri = result.assets[0]?.uri;
    if (!pickedUri) return;
    setImageUri(pickedUri);
  };

  const handleCapture = async () => {
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
    setImageUri(pickedUri);
  };

  const handleSegment = () => {
    if (!imageUri) return;
    setIsSegmenting(true);
    // Simulate processing
    setTimeout(() => {
      setIsSegmenting(false);
      router.push({ pathname: "/segment", params: { uri: imageUri } });
    }, 500);
  };

  const handleClear = () => {
    setImageUri(null);
  };

  const insets = useSafeAreaInsets();

  return (
    <Box flex={1} bg="#0a0e27">
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header - Modern Gradient Look */}
        <Box px="$6" pt={insets.top + 20} pb="$6">
          <Heading
            color="$white"
            fontSize="$4xl"
            textAlign="center"
            fontWeight="$black"
            mb="$2"
            pt="$10"
          >
            SAM 3D Demo
          </Heading>
          <Text
            color="#64748b"
            fontSize="$lg"
            fontWeight="$medium"
            textAlign="center"
          >
            Transform images into 3D models
          </Text>
        </Box>

        {/* Image Preview Card - Modern Gradient Border */}
        <Box px="$6" mt="$6" mb="$10">
          <Box
            borderRadius="$2xl"
            overflow="hidden"
            borderWidth={2}
            borderColor="#1e3a8a"
            bg="#111827"
          >
            <Box
              h={280}
              bg="#0f172a"
              borderRadius="$2xl"
              justifyContent="center"
              alignItems="center"
              position="relative"
            >
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  alt="Selected image"
                  width="100%"
                  height="100%"
                />
              ) : (
                <VStack alignItems="center" space="lg">
                  <Box
                    w={80}
                    h={80}
                    borderRadius="$full"
                    bg="#1e293b"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <ImagePlus size={40} color="#3b82f6" />
                  </Box>
                  <VStack alignItems="center" space="xs">
                    <Text color="$white" fontSize="$lg" fontWeight="$semibold">
                      No image selected
                    </Text>
                    <Text color="#64748b" fontSize="$sm">
                      Pick from gallery or take a photo
                    </Text>
                  </VStack>
                </VStack>
              )}
            </Box>
          </Box>
        </Box>

        {/* Action Buttons - Modern Style */}
        <Box px="$6" mb="$12">
          <VStack space="sm">
            {/* Gallery & Camera Row */}
            <HStack space="sm">
              <Button
                flex={1}
                bg="#1e293b"
                onPress={handleGallerySelect}
                borderRadius="$xl"
                h={48}
                borderWidth={1}
                borderColor="#334155"
                borderStyle="solid"
                sx={{
                  ":pressed": {
                    bg: "#0f172a",
                  },
                }}
              >
                <HStack space="sm" alignItems="center">
                  <ImagePlus size={20} color="#94a3b8" />
                  <ButtonText
                    color="#e2e8f0"
                    fontWeight="$semibold"
                    fontSize="$sm"
                  >
                    Gallery
                  </ButtonText>
                </HStack>
              </Button>

              <Button
                flex={1}
                bg="#1e293b"
                onPress={handleCapture}
                borderRadius="$xl"
                h={48}
                borderWidth={1}
                borderColor="#334155"
                borderStyle="solid"
                sx={{
                  ":pressed": {
                    bg: "#0f172a",
                  },
                }}
              >
                <HStack space="sm" alignItems="center">
                  <Camera size={20} color="#94a3b8" />
                  <ButtonText
                    color="#e2e8f0"
                    fontWeight="$semibold"
                    fontSize="$sm"
                  >
                    Camera
                  </ButtonText>
                </HStack>
              </Button>
            </HStack>

            {/* Segment Button */}
            <Button
              w="$full"
              bg={imageUri && !isSegmenting ? "#334155" : "#1e293b"}
              onPress={handleSegment}
              disabled={!imageUri || isSegmenting}
              borderRadius="$xl"
              h={48}
              borderWidth={1}
              borderColor={imageUri && !isSegmenting ? "#475569" : "#334155"}
              borderStyle="solid"
              sx={{
                ":pressed": {
                  bg: "#0f172a",
                },
              }}
            >
              {isSegmenting ? (
                <HStack
                  space="md"
                  alignItems="center"
                  w="$full"
                  justifyContent="center"
                >
                  <Spinner color="#cbd5e1" />
                  <ButtonText color="#cbd5e1" fontWeight="$semibold">
                    Processing...
                  </ButtonText>
                </HStack>
              ) : (
                <HStack space="sm" alignItems="center">
                  <ButtonText
                    color={imageUri ? "#e2e8f0" : "#64748b"}
                    fontWeight="$semibold"
                    fontSize="$md"
                  >
                    Segment Object
                  </ButtonText>
                  <ArrowRight
                    size={20}
                    color={imageUri ? "#e2e8f0" : "#64748b"}
                  />
                </HStack>
              )}
            </Button>

            {/* Clear Button */}
            <Button
              w="$full"
              bg={imageUri ? "#334155" : "#1e293b"}
              onPress={handleClear}
              disabled={!imageUri}
              borderRadius="$xl"
              h={48}
              borderWidth={1}
              borderColor={imageUri ? "#475569" : "#334155"}
              borderStyle="solid"
              sx={{
                ":pressed": {
                  bg: "#0f172a",
                },
              }}
            >
              <HStack space="sm" alignItems="center">
                <Trash2 size={20} color={imageUri ? "#e2e8f0" : "#64748b"} />
                <ButtonText
                  color={imageUri ? "#e2e8f0" : "#64748b"}
                  fontWeight="$semibold"
                >
                  Clear
                </ButtonText>
              </HStack>
            </Button>
          </VStack>
        </Box>

        <Box px="$6" mb="$2">
          <Button
            w="$full"
            bg="transparent"
            borderWidth={2}
            borderColor="#3b82f6"
            borderStyle="solid"
            onPress={() => router.push("/saved-models")}
            borderRadius="$xl"
            h={48}
          >
            <HStack space="sm" alignItems="center">
              <FileText size={20} color="#3b82f6" />
              <ButtonText color="#3b82f6" fontWeight="$bold">
                View Saved Models
              </ButtonText>
            </HStack>
          </Button>
        </Box>
      </ScrollView>
    </Box>
  );
};

export default HomeScreen;
