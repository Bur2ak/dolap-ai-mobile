import * as ImagePicker from "expo-image-picker";
import { useState } from "react";

export function useImagePicker() {
  const [isPicking, setIsPicking] = useState(false);

  async function pickFromLibrary() {
    setIsPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Fotograf izni gerekli.");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 5],
        mediaTypes: ["images"],
        quality: 0.9,
      });

      if (result.canceled) {
        return null;
      }

      return result.assets[0]?.uri ?? null;
    } finally {
      setIsPicking(false);
    }
  }

  async function takePhoto() {
    setIsPicking(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Kamera izni gerekli.");
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.9,
      });

      if (result.canceled) {
        return null;
      }

      return result.assets[0]?.uri ?? null;
    } finally {
      setIsPicking(false);
    }
  }

  async function pickMultipleFromLibrary(maxCount = 10): Promise<string[]> {
    setIsPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Fotograf izni gerekli.");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        mediaTypes: ["images"],
        quality: 0.9,
        selectionLimit: maxCount,
      });

      if (result.canceled) return [];
      return result.assets.map((a) => a.uri);
    } finally {
      setIsPicking(false);
    }
  }

  return { isPicking, pickFromLibrary, pickMultipleFromLibrary, takePhoto };
}
