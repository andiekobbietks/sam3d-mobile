export type RunPodOutput =
  | { model_url: string }
  | { error: string }
  | Record<string, unknown>;

const API_BASE = "https://YOUR-PROXY.example.com"; // recommended
const SAM_API_BASE = "https://8vqkpqlcboe32a-8001.proxy.runpod.net"; // SAM 2 API endpoint

export async function submitSam3dJob(input: {
  image_b64: string;
  point: { x: number; y: number };
}) {
  const res = await fetch(`${API_BASE}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`submit failed: ${res.status}`);
  const json = await res.json();
  return json.id as string;
}

export async function pollSam3dJob(jobId: string) {
  while (true) {
    const res = await fetch(`${API_BASE}/status/${jobId}`);
    if (!res.ok) throw new Error(`status failed: ${res.status}`);
    const json = await res.json();

    if (json.status === "COMPLETED") return json.output as RunPodOutput;
    if (json.status === "FAILED") throw new Error(json.error ?? "Job failed");

    await new Promise((r) => setTimeout(r, 1500));
  }
}

export async function segmentWithSam2(input: {
  image_b64: string;
  points: Array<{ x: number; y: number }>;
  previous_mask?: string;
  mask_threshold?: number;
}) {
  const payload: any = {
    image: input.image_b64,
    points: input.points,
    mask_threshold: 0.0,
  };

  if (input.previous_mask) {
    payload.previous_mask = input.previous_mask;
  }

  const res = await fetch(`${SAM_API_BASE}/segment-binary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`SAM2 segmentation failed: ${res.status} - ${errorText}`);
  }

  const json = await res.json();
  return json as {
    success: boolean;
    mask: string;
    score: number;
  };
}

/**
 * Start 3D generation task (returns immediately with task_id)
 * Uses polling to avoid gateway timeouts for long-running inference
 */
async function startSam3dGeneration(input: {
  image_b64: string;
  mask_b64: string;
  seed?: number;
}): Promise<string> {
  const payload = {
    image: input.image_b64,
    mask: input.mask_b64,
    seed: input.seed ?? 42,
  };

  const res = await fetch(`${SAM_API_BASE}/generate-3d`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Failed to start 3D generation: ${res.status} - ${errorText}`
    );
  }

  const json = await res.json();
  return json.task_id as string;
}

/**
 * Poll for 3D generation results
 */
async function pollSam3dStatus(
  taskId: string,
  maxAttempts: number = 120,
  pollInterval: number = 2000,
  onProgress?: (progress: number, status: string) => void
): Promise<{
  success: boolean;
  ply_b64?: string;
  ply_url?: string;
  progress?: number;
  status?: string;
  error?: string;
}> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const res = await fetch(`${SAM_API_BASE}/generate-3d-status/${taskId}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Task not found");
        }
        throw new Error(`Status check failed: ${res.status}`);
      }

      const statusData = await res.json();
      console.log(
        `[${attempts + 1}/${maxAttempts}] Status: ${
          statusData.status
        }, Progress: ${statusData.progress}%`
      );

      // Call progress callback if provided
      if (onProgress) {
        onProgress(statusData.progress ?? 0, statusData.status);
      }

      if (statusData.status === "completed") {
        console.log("✓ Task completed, ply_b64 present:", !!statusData.ply_b64);
        return {
          success: true,
          ply_b64: statusData.ply_b64,
          ply_url: statusData.ply_url,
        };
      }

      if (statusData.status === "failed") {
        throw new Error(`Generation failed: ${statusData.error}`);
      }

      // Still processing or queued, wait and try again
      if (
        statusData.status === "processing" ||
        statusData.status === "queued"
      ) {
        await new Promise((r) => setTimeout(r, pollInterval));
        attempts++;
        continue;
      }

      throw new Error(`Unknown status: ${statusData.status}`);
    } catch (error: any) {
      console.error(`Poll attempt ${attempts + 1} failed:`, error);
      throw error;
    }
  }

  throw new Error(
    `3D generation timed out after ${
      (maxAttempts * pollInterval) / 1000
    } seconds`
  );
}

/**
 * Main function: Start 3D generation and poll for results
 * Handles long-running inference without timeout issues
 */
export async function generateSam3dObject(input: {
  image_b64: string;
  mask_b64: string;
  seed?: number;
  onProgress?: (progress: number, status: string) => void;
}): Promise<{
  success: boolean;
  ply_b64?: string;
  ply_url?: string;
  error?: string;
}> {
  try {
    console.log("Starting 3D generation...");

    // Step 1: Start the task (returns immediately)
    const taskId = await startSam3dGeneration({
      image_b64: input.image_b64,
      mask_b64: input.mask_b64,
      seed: input.seed,
    });
    console.log(`✓ Task started with ID: ${taskId}`);

    // Step 2: Poll for results
    const result = await pollSam3dStatus(taskId, 120, 2000, input.onProgress);
    console.log("✓ 3D generation complete!");
    console.log("Result:", {
      success: result.success,
      hasPlyB64: !!result.ply_b64,
      hasPlyUrl: !!result.ply_url,
    });

    return {
      success: true,
      ply_b64: result.ply_b64,
      ply_url: result.ply_url,
    };
  } catch (error: any) {
    console.error("3D generation error:", error);
    return {
      success: false,
      error: error?.message ?? "Unknown error",
    };
  }
}
