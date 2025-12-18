/**
 * Global state for passing GIF data between screens
 * Necessary because route params have size limits
 */

let gifDataCache: string | null = null;
let shouldAutoSave = false; // Flag to indicate if GIF should be auto-saved (only once per generation)
let hasAlreadySaved = false; // Prevent duplicate saves

export function setPlyData(data: string, gifData?: string, autoSave = true) {
  // For backwards compatibility, gifData parameter takes precedence
  gifDataCache = gifData || null;
  shouldAutoSave = autoSave;
  hasAlreadySaved = false; // Reset so new data will be saved once
  console.log(
    `[Cache] Stored GIF ${
      gifData?.length ?? 0
    } bytes (autoSave: ${autoSave})`
  );
}

export function getPlyData(): string | null {
  // Deprecated - returns null as we no longer store PLY files
  return null;
}

export function getGifData(): string | null {
  const data = gifDataCache;
  console.log(`[Cache] Retrieved GIF ${data?.length ?? 0} bytes`);
  return data;
}

export function shouldSavePlyData(): boolean {
  // Only save once per generation
  if (shouldAutoSave && !hasAlreadySaved) {
    return true;
  }
  return false;
}

export function markAsSaved() {
  // Call this after successfully saving to prevent duplicate saves
  hasAlreadySaved = true;
  console.log("[Cache] Marked as saved, preventing duplicates");
}

export function clearPlyData() {
  gifDataCache = null;
  shouldAutoSave = false;
  hasAlreadySaved = false;
  console.log("[Cache] Cleared");
}
