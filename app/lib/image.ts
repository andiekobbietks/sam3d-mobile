import * as ImageManipulator from "expo-image-manipulator";

export async function uriToResizedBase64(uri: string) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!result.base64) throw new Error("Failed to produce base64 image");
  return result.base64; // no data: prefix
}
