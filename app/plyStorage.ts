import * as FileSystem from "expo-file-system";

/**
 * PLY File Storage Manager
 * Handles saving, retrieving, and deleting PLY files from app storage
 */

const PLY_STORAGE_DIR = `${FileSystem.documentDirectory}ply_models/`;

export interface PlyFile {
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
    const dirInfo = await FileSystem.getInfoAsync(PLY_STORAGE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PLY_STORAGE_DIR, {
        intermediates: true,
      });
      console.log("[PLY Storage] Created storage directory");
    }
  } catch (err) {
    console.error("[PLY Storage] Error creating directory:", err);
    throw err;
  }
}

/**
 * Save PLY file with timestamp
 */
export async function savePlyFile(
  plyBase64: string,
  fileName?: string
): Promise<PlyFile> {
  try {
    await ensureStorageDir();

    const timestamp = Date.now();
    const name = fileName || `model_${timestamp}.ply`;
    const filePath = `${PLY_STORAGE_DIR}${name}`;

    await FileSystem.writeAsStringAsync(filePath, plyBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const info = await FileSystem.getInfoAsync(filePath);
    const fileSize = info.size || 0;

    const plyFile: PlyFile = {
      fileName: name,
      filePath,
      fileSize,
      createdAt: timestamp,
      createdDate: new Date(timestamp).toLocaleString(),
    };

    console.log(
      `[PLY Storage] Saved: ${name} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`
    );

    return plyFile;
  } catch (err) {
    console.error("[PLY Storage] Error saving file:", err);
    throw err;
  }
}

/**
 * Get all saved PLY files
 */
export async function getPlyFiles(): Promise<PlyFile[]> {
  try {
    await ensureStorageDir();

    const files = await FileSystem.readDirectoryAsync(PLY_STORAGE_DIR);
    const plyFiles: PlyFile[] = [];

    for (const fileName of files) {
      if (!fileName.endsWith(".ply")) continue;

      const filePath = `${PLY_STORAGE_DIR}${fileName}`;
      const info = await FileSystem.getInfoAsync(filePath);

      if (info.exists) {
        const createdAt = info.modificationTime
          ? Math.floor(info.modificationTime * 1000)
          : Date.now();

        plyFiles.push({
          fileName,
          filePath,
          fileSize: info.size || 0,
          createdAt,
          createdDate: new Date(createdAt).toLocaleString(),
        });
      }
    }

    // Sort by creation time (newest first)
    plyFiles.sort((a, b) => b.createdAt - a.createdAt);

    console.log(`[PLY Storage] Found ${plyFiles.length} files`);
    return plyFiles;
  } catch (err) {
    console.error("[PLY Storage] Error reading files:", err);
    return [];
  }
}

/**
 * Get PLY file by name
 */
export async function getPlyFile(fileName: string): Promise<PlyFile | null> {
  try {
    const filePath = `${PLY_STORAGE_DIR}${fileName}`;
    const info = await FileSystem.getInfoAsync(filePath);

    if (!info.exists) {
      console.warn(`[PLY Storage] File not found: ${fileName}`);
      return null;
    }

    const createdAt = info.modificationTime
      ? Math.floor(info.modificationTime * 1000)
      : Date.now();

    return {
      fileName,
      filePath,
      fileSize: info.size || 0,
      createdAt,
      createdDate: new Date(createdAt).toLocaleString(),
    };
  } catch (err) {
    console.error("[PLY Storage] Error getting file:", err);
    return null;
  }
}

/**
 * Read PLY file as base64
 */
export async function readPlyFile(fileName: string): Promise<string | null> {
  try {
    const filePath = `${PLY_STORAGE_DIR}${fileName}`;
    const data = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log(`[PLY Storage] Read file: ${fileName} (${data.length} bytes)`);
    return data;
  } catch (err) {
    console.error("[PLY Storage] Error reading file:", err);
    return null;
  }
}

/**
 * Delete PLY file
 */
export async function deletePlyFile(fileName: string): Promise<boolean> {
  try {
    const filePath = `${PLY_STORAGE_DIR}${fileName}`;
    const info = await FileSystem.getInfoAsync(filePath);

    if (!info.exists) {
      console.warn(`[PLY Storage] File not found: ${fileName}`);
      return false;
    }

    await FileSystem.deleteAsync(filePath);
    console.log(`[PLY Storage] Deleted: ${fileName}`);
    return true;
  } catch (err) {
    console.error("[PLY Storage] Error deleting file:", err);
    return false;
  }
}

/**
 * Delete all PLY files
 */
export async function deleteAllPlyFiles(): Promise<boolean> {
  try {
    const files = await getPlyFiles();
    let deletedCount = 0;

    for (const file of files) {
      const success = await deletePlyFile(file.fileName);
      if (success) deletedCount++;
    }

    console.log(`[PLY Storage] Deleted ${deletedCount} files`);
    return true;
  } catch (err) {
    console.error("[PLY Storage] Error deleting all files:", err);
    return false;
  }
}

/**
 * Get total storage size of PLY files
 */
export async function getTotalStorageSize(): Promise<number> {
  try {
    const files = await getPlyFiles();
    return files.reduce((total, file) => total + file.fileSize, 0);
  } catch (err) {
    console.error("[PLY Storage] Error calculating size:", err);
    return 0;
  }
}
