import * as ImageManipulator from "expo-image-manipulator";

export async function optimizeImage(uri: string): Promise<string> {
  const normalizedUri = normalizeImageUri(uri);
  const result = await ImageManipulator.manipulateAsync(
    normalizedUri,
    [{ resize: { width: 800 } }],
    {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return result.uri;
}

export async function createThumbnail(uri: string): Promise<string> {
  const normalizedUri = normalizeImageUri(uri);
  const result = await ImageManipulator.manipulateAsync(
    normalizedUri,
    [{ resize: { width: 240 } }],
    {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return result.uri;
}

function normalizeImageUri(uri: string) {
  const normalizedUri = uri.trim();
  if (!normalizedUri) {
    throw new Error("Gorsel yolu bos.");
  }

  return normalizedUri;
}
