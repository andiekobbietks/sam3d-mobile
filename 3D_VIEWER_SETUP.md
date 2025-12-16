# 3D Viewer Setup Guide

This guide explains how to display the generated PLY files in the 3D viewer.

## Architecture

```
Segmentation Screen
    ↓ Generate 3D button
Backend /generate-3d endpoint
    ↓ Returns task_id
Frontend polls /generate-3d-status/{task_id}
    ↓ Receives ply_b64 when complete
Navigate to /viewer with plyData
    ↓ Viewer Component
Display 3D model with Three.js
```

## Installation

### 1. Install Dependencies

```bash
npm install three expo-gl
# or
yarn add three expo-gl
```

### 2. Update package.json

Already done in your project. Should include:

```json
{
  "dependencies": {
    "three": "^r128",
    "expo-gl": "~14.0.0"
  }
}
```

## Frontend Components

### Viewer Screen (`app/viewer.tsx`)

The viewer component is already created and handles:

1. **Scene Setup**

   - Three.js scene with dark background
   - Camera positioned to view the model
   - Lighting (ambient + directional)

2. **PLY Loading**

   - Receives base64 PLY data from route params
   - Converts base64 → Blob → Object URL
   - Uses THREE.PLYLoader to parse geometry
   - Creates point cloud mesh with proper colors

3. **Interactions**

   - **Drag to rotate:** Mouse drag updates mesh rotation
   - **Scroll to zoom:** Mouse wheel adjusts camera z position
   - **Auto-rotate:** Model slowly rotates when not dragging

4. **Geometry Centering**
   - Auto-centers model in view
   - Scales to fit properly
   - Computes bounding box for scale

### Segmentation Screen Update (`app/segment.tsx`)

The `handleGenerate3d()` function now:

1. Calls `generateSam3dObject()` with image + mask
2. Receives `ply_b64` (base64 encoded PLY file)
3. Navigates to viewer:
   ```typescript
   router.push({
     pathname: "/viewer",
     params: { plyData: result.ply_b64 },
   });
   ```

## Backend Requirements

The backend should return `ply_b64` in the status response:

```python
# In /generate-3d-status/{task_id} endpoint
if task["status"] == "completed":
    # PLY file is stored as bytes
    with open(task["ply_path"], "rb") as f:
        ply_bytes = f.read()

    ply_b64 = base64.b64encode(ply_bytes).decode("utf-8")

    return {
        "status": "completed",
        "progress": 100,
        "ply_b64": ply_b64,
        "ply_size_bytes": len(ply_bytes)
    }
```

## How It Works

### Step 1: Start Generation

Frontend calls `POST /generate-3d`:

```typescript
{
  "image": "iVBORw0KGgo...",  // base64 image
  "mask": "iVBORw0KGgo...",   // base64 mask
  "seed": 42
}
```

Backend returns:

```json
{
  "success": true,
  "task_id": "a1b2c3d4-...",
  "status": "queued"
}
```

### Step 2: Poll for Status

Frontend repeatedly calls `GET /generate-3d-status/{task_id}`:

While processing:

```json
{
  "status": "processing",
  "progress": 45,
  "created_at": "2024-12-16T10:30:00"
}
```

When complete:

```json
{
  "status": "completed",
  "progress": 100,
  "ply_b64": "UGx5YQoxLjAKZm9ybWF0IGFzY2lp...",
  "ply_size_bytes": 1024000
}
```

### Step 3: Display in Viewer

Frontend receives `ply_b64` and navigates:

```typescript
router.push({
  pathname: "/viewer",
  params: { plyData: result.ply_b64 },
});
```

Viewer component:

1. Converts base64 → ArrayBuffer
2. Creates Blob from binary data
3. Generates Object URL
4. Loads with PLYLoader
5. Creates THREE.Points mesh
6. Renders with controls

## Troubleshooting

### Issue: Canvas not rendering

- Ensure `expo-gl` is installed
- Check that `window` object exists (web/native support)
- Verify canvas context creation

### Issue: PLY not loading

- Check base64 encoding on backend
- Verify PLY format is valid
- Look for console errors in viewer component
- Test PLY file locally: `python -m pdb` on a reference PLY

### Issue: Model appears upside down or rotated

- Adjust initial camera position in `initializeScene()`
- Modify mesh rotation offset in `onMouseDown()`
- Check PLY coordinate system (Y-up vs Z-up)

### Issue: Large models cause lag

- Reduce point cloud size on backend
- Decimation: sample every Nth point
- Use BufferGeometry indexed rendering
- Lower renderer pixel ratio

## Customization

### Change Background Color

```typescript
scene.background = new THREE.Color(0x1a1a1a); // Darker gray
```

### Adjust Rotation Speed

```typescript
if (meshRef.current && !touchStateRef.current.isDragging) {
  meshRef.current.rotation.y += 0.005; // Faster
}
```

### Change Point Size

```typescript
const material = new THREE.PointsMaterial({
  size: 0.02, // Larger points
  // ... rest
});
```

### Add Fullscreen Button

```typescript
const toggleFullscreen = () => {
  if (canvasRef.current?.requestFullscreen) {
    canvasRef.current.requestFullscreen();
  }
};
```

## Performance Tips

1. **Decimation:** Reduce vertex count on backend

   ```python
   # Keep every 4th vertex
   indices = np.arange(0, len(vertices), 4)
   vertices = vertices[indices]
   ```

2. **Level of Detail:** Generate multiple LOD versions

   - Full resolution for final view
   - Low res for quick loading

3. **Streaming:** Load and render in chunks

   - Not implemented by default
   - Consider for very large models

4. **Worker Threads:** Move PLY parsing to web worker
   - Prevents UI freeze during load
   - More complex setup

## Testing

1. **Local Testing**

   ```bash
   npm run web
   # Navigate to segmentation → tap object → generate 3D
   ```

2. **Check Console**

   - Look for "✓ PLY loaded" message
   - Check geometry vertex count
   - Verify material creation

3. **Test Files**
   - Use small sample PLY files first
   - Verify coordinate systems match
   - Test with known good models

## Next Steps

1. Deploy backend with `/generate-3d` and `/generate-3d-status/{task_id}` endpoints
2. Run `npm install` to add Three.js dependencies
3. Test the full pipeline: image → segment → generate → view
4. Optimize based on actual model sizes and performance
