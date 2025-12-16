/**
 * Global state for passing PLY data between screens
 * Necessary because route params have size limits
 */

let plyDataCache: string | null = null;
let shouldAutoSave = false; // Flag to indicate if PLY should be auto-saved

export function setPlyData(data: string, autoSave = true) {
  plyDataCache = data;
  shouldAutoSave = autoSave;
  console.log(
    `[PLY Cache] Stored ${data.length} bytes (autoSave: ${autoSave})`
  );
}

export function getPlyData(): string | null {
  const data = plyDataCache;
  console.log(`[PLY Cache] Retrieved ${data?.length ?? 0} bytes`);
  return data;
}

export function shouldSavePlyData(): boolean {
  return shouldAutoSave;
}

export function clearPlyData() {
  plyDataCache = null;
  shouldAutoSave = false;
  console.log("[PLY Cache] Cleared");
}
