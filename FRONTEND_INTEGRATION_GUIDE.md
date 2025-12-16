# Frontend Integration Summary: SAM 2 → Sam-3d-objects

## Architecture Flow

```
User Image
    ↓
[Tap Points on Segmentation Screen]
    ↓
SAM 2 API (/segment-binary)
    ├─ Input: image + points + previous_mask
    └─ Output: binary mask (base64 PNG)
    ↓
[Display Mask Overlay]
    ├─ Can add more points to refine
    └─ Can reset and start over
    ↓
[Generate 3D Object Button]
    ↓
Sam-3d-objects API (/generate-3d)
    ├─ Input: image + mask + seed
    └─ Output: PLY (base64 or URL)
    ↓
[3D Viewer Screen]
    └─ Render Gaussian splat with Three.js
```

## Frontend Files Modified

### 1. [app/lib/runpod.ts](app/lib/runpod.ts)

**Added function:**

```typescript
export async function generateSam3dObject(input: {
  image_b64: string;
  mask_b64: string;
  seed?: number;
});
```

**Returns:**

```typescript
{
  success: boolean;
  ply_b64?: string;        // Base64 encoded PLY file
  ply_url?: string;        // Direct URL to PLY (if using cloud storage)
  error?: string;          // Error message if failed
}
```

### 2. [app/segment.tsx](app/segment.tsx)

**Changes:**

- Added `generating3d` loading state
- New function `handleGenerate3d()` that:
  - Extracts image and mask as base64
  - Calls `generateSam3dObject()`
  - Navigates to viewer with PLY model URL
- Replaced "Submit to RunPod" button with "Generate 3D Object" button
- Button shows "Tap to segment first" when no mask available
- Button disabled during generation (shows loading spinner)

## User Flow

### Step 1: Load Image

- User imports image from camera/gallery

### Step 2: Segment Object

- Tap one or more points on the object
- Each tap triggers SAM 2 segmentation
- Mask overlay appears on screen
- Can refine by adding more points
- Can reset and start over

### Step 3: Generate 3D

- Click "Generate 3D Object" button
- Button shows loading spinner during generation
- Backend runs Sam-3d-objects inference (~10-30 seconds)
- PLY file returned as base64 or URL

### Step 4: View 3D Model

- Navigates to `/viewer` screen
- Renders Gaussian splat
- Interactive 3D controls

## Key Implementation Details

### State Management

```typescript
const [tapPositions, setTapPositions] = useState([]); // All taps for refinement
const [maskImage, setMaskImage] = useState(null); // Current segmentation mask
const [generating3d, setGenerating3d] = useState(false); // 3D generation loading
```

### Mask Extraction

```typescript
// From data URI to base64
const mask_b64 = maskImage.split(",")[1]; // Remove "data:image/png;base64," prefix
```

### Error Handling

- Shows Alert dialogs for user-facing errors
- Logs detailed errors to console for debugging
- Handles both base64 and URL responses from backend

## Backend Endpoint Contract

### POST /generate-3d

**Request:**

```json
{
  "image": "iVBORw0KGgoAAAANSUhEUgAAAAUA...", // base64 PNG
  "mask": "iVBORw0KGgoAAAANSUhEUgAAAAUA...", // base64 PNG (binary)
  "seed": 42 // optional
}
```

**Success Response (200):**

```json
{
  "success": true,
  "ply_b64": "ply\nformat ascii 1.0\n..." // base64 encoded PLY file
}
```

OR

```json
{
  "success": true,
  "ply_url": "https://storage.example.com/models/abc123.ply"
}
```

**Error Response (400+):**

```json
{
  "success": false,
  "error": "Mask dimensions don't match image dimensions"
}
```

## Viewer Integration

The viewer should expect one of:

1. **Base64 PLY Data:**

   ```typescript
   const modelUrl = `data:model/ply;base64,${ply_b64}`;
   ```

2. **Direct URL:**
   ```typescript
   const modelUrl = ply_url; // e.g., https://...
   ```

The viewer can then load with Three.js:

```javascript
// Pseudo-code
const geometry = PLYLoader.load(modelUrl);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
```

## Testing Checklist

- [ ] Segment object with multiple taps
- [ ] Verify mask accumulates (coverage increases or stays same)
- [ ] Click "Generate 3D Object" button
- [ ] Observe loading spinner
- [ ] Verify 3D model loads in viewer
- [ ] Test with different objects/masks
- [ ] Verify error handling for:
  - [ ] Backend timeout
  - [ ] Invalid image format
  - [ ] Mask/image dimension mismatch
  - [ ] Missing PLY in response

## Environment Variables

Add to backend if needed:

- `SAM3D_MODEL_PATH` - Path to model checkpoints
- `MAX_INFERENCE_TIME` - Timeout for inference (e.g., 60 seconds)
- `PLY_STORAGE_BUCKET` - Cloud storage bucket for PLY files (if using URLs)
