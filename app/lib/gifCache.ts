/**
 * Global state for passing GIF data between screens
 * Necessary because route params have size limits
 */

let gifDataCache: string | null = null;
let shouldAutoSave = false; // Flag to indicate if GIF should be auto-saved (only once per generation)
let hasAlreadySaved = false; // Prevent duplicate saves

export function setGifData(gifData?: string, autoSave = true) {
  // Caches GIF data for passing between screens
  gifDataCache = gifData || null;
  shouldAutoSave = autoSave;
  hasAlreadySaved = false; // Reset so new data will be saved once
  console.log(
    `[GifCache] Stored GIF ${
      gifData?.length ?? 0
    } bytes (autoSave: ${autoSave})`
  );
}

export function getGifData(): string | null {
  const data = gifDataCache;
  console.log(`[GifCache] Retrieved GIF ${data?.length ?? 0} bytes`);
  return data;
}

export function shouldSaveGifData(): boolean {
  // Only save once per generation
  if (shouldAutoSave && !hasAlreadySaved) {
    return true;
  }
  return false;
}

export function markAsSaved() {
  // Call this after successfully saving to prevent duplicate saves
  hasAlreadySaved = true;
  console.log("[GifCache] Marked as saved, preventing duplicates");
}

export function clearGifData() {
  gifDataCache = null;
  shouldAutoSave = false;
  hasAlreadySaved = false;
  console.log("[GifCache] Cleared all cached data");
}
