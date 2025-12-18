import * as FileSystem from "expo-file-system/legacy";

/**
 * GIF File Storage Manager
 * Handles saving, retrieving, and deleting GIF files from app storage
 */

const GIF_STORAGE_DIR = `${FileSystem.documentDirectory}gif_models/`;

export interface GifFile {
  fileName: string;
  filePath: string;
  fileSize: number;
  createdAt: number;
  createdDate: string;
}

/**
 * Initialize storage directory
 */
async function ensureStorageDir() {
  try {
    const dirInfo = await FileSystem.getInfoAsync(GIF_STORAGE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(GIF_STORAGE_DIR, {
        intermediates: true,
      });
      console.log("[GIF Storage] Created storage directory");
    }
  } catch (err) {
    console.error("[GIF Storage] Error creating directory:", err);
    throw err;
  }
}

/**
 * Save GIF file with timestamp
 */
export async function saveGifFile(
  gifBase64: string,
  fileName?: string
): Promise<GifFile> {
  try {
    await ensureStorageDir();

    const timestamp = Date.now();
    const name = fileName || `model_${timestamp}.gif`;
    const filePath = `${GIF_STORAGE_DIR}${name}`;

    await FileSystem.writeAsStringAsync(filePath, gifBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const info = await FileSystem.getInfoAsync(filePath);
    const fileSize = (info as any).size || 0;

    const gifFile: GifFile = {
      fileName: name,
      filePath,
      fileSize,
      createdAt: timestamp,
      createdDate: new Date(timestamp).toLocaleString(),
    };

    console.log(
      `[GIF Storage] Saved: ${name} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`
    );

    return gifFile;
  } catch (err) {
    console.error("[GIF Storage] Error saving file:", err);
    throw err;
  }
}

/**
 * Get all saved GIF files
 */
export async function getGifFiles(): Promise<GifFile[]> {
  try {
    await ensureStorageDir();

    const files = await FileSystem.readDirectoryAsync(GIF_STORAGE_DIR);
    const gifFiles: GifFile[] = [];

    for (const fileName of files) {
      if (!fileName.endsWith(".gif")) continue;

      const filePath = `${GIF_STORAGE_DIR}${fileName}`;
      const info = await FileSystem.getInfoAsync(filePath);

      if (info.exists) {
        const createdAt = info.modificationTime
          ? Math.floor(info.modificationTime * 1000)
          : Date.now();

        gifFiles.push({
          fileName,
          filePath,
          fileSize: info.size || 0,
          createdAt,
          createdDate: new Date(createdAt).toLocaleString(),
        });
      }
    }

    // Sort by creation time (newest first)
    gifFiles.sort((a, b) => b.createdAt - a.createdAt);

    console.log(`[GIF Storage] Found ${gifFiles.length} GIF files`);
    return gifFiles;
  } catch (err) {
    console.error("[GIF Storage] Error reading files:", err);
    throw err;
  }
}

/**
 * Read GIF file as base64
 */
export async function readGifFile(fileName: string): Promise<string | null> {
  try {
    const filePath = `${GIF_STORAGE_DIR}${fileName}`;
    const data = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log(`[GIF Storage] Read: ${fileName} (${data.length} bytes)`);
    return data;
  } catch (err) {
    console.error("[GIF Storage] Error reading file:", err);
    throw err;
  }
}

/**
 * Delete single GIF file
 */
export async function deleteGifFile(fileName: string): Promise<boolean> {
  try {
    const filePath = `${GIF_STORAGE_DIR}${fileName}`;
    await FileSystem.deleteAsync(filePath);
    console.log(`[GIF Storage] Deleted: ${fileName}`);
    return true;
  } catch (err) {
    console.error("[GIF Storage] Error deleting file:", err);
    return false;
  }
}

/**
 * Delete all GIF files
 */
export async function deleteAllGifFiles(): Promise<boolean> {
  try {
    const files = await getGifFiles();
    for (const file of files) {
      await deleteGifFile(file.fileName);
    }
    console.log(`[GIF Storage] Deleted all files`);
    return true;
  } catch (err) {
    console.error("[GIF Storage] Error deleting all files:", err);
    return false;
  }
}

/**
 * Get total storage size in bytes
 */
export async function getTotalStorageSize(): Promise<number> {
  try {
    const files = await getGifFiles();
    const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0);
    console.log(
      `[GIF Storage] Total storage: ${(totalSize / 1024 / 1024).toFixed(2)} MB`
    );
    return totalSize;
  } catch (err) {
    console.error("[GIF Storage] Error calculating size:", err);
    return 0;
  }
}
