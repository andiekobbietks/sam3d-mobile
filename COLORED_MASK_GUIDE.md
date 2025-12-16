# Update /segment-binary Endpoint to Preserve Image Colors

This guide shows how to modify your existing `/segment-binary` endpoint to apply the mask to the original image while preserving colors.

## Change Summary

**Before:** Returns binary black & white mask

```
Foreground: White (255, 255, 255)
Background: Black (0, 0, 0)
```

**After:** Returns masked image with original colors

```
Foreground: Original image colors
Background: Black (0, 0, 0)
```

## Implementation

### Find Your Mask Encoding Section

Locate where you're encoding the mask as PNG. It should look something like:

```python
# Old code - returns binary mask
masks_smooth = post_process_mask(mask, dilate=True)
mask_png = cv2.imencode(".png", masks_smooth * 255)[1]
mask_b64 = base64.b64encode(mask_png).decode("utf-8")

return {
    "success": True,
    "mask": mask_b64,
    "score": float(score)
}
```

### Replace With Color-Preserved Version

```python
# New code - returns masked image with original colors
masks_smooth = post_process_mask(mask, dilate=True)

# Apply mask to preserve image colors
# Expand mask to 3 channels (R, G, B)
mask_3ch = np.stack([masks_smooth] * 3, axis=-1)  # Shape: (H, W, 3), values 0-1

# Apply mask: foreground keeps original colors, background becomes black
masked_image = (image * mask_3ch).astype(np.uint8)

# Convert RGB to BGR for OpenCV encoding
masked_image_bgr = cv2.cvtColor(masked_image, cv2.COLOR_RGB2BGR)

# Encode as PNG
success, masked_png = cv2.imencode(".png", masked_image_bgr)
if not success:
    raise Exception("Failed to encode masked image")

mask_b64 = base64.b64encode(masked_png).decode("utf-8")

return {
    "success": True,
    "mask": mask_b64,
    "score": float(score)
}
```

## Key Differences

| Aspect      | Before            | After                         |
| ----------- | ----------------- | ----------------------------- |
| Mask format | Binary (0 or 255) | RGB image (0-255 per channel) |
| Foreground  | White pixels      | Original image colors         |
| Background  | Black pixels      | Black pixels                  |
| File size   | Smaller (~50KB)   | Larger (~500KB typical)       |
| Visual      | Silhouette only   | Textured cutout               |

## Visualization

```
Original Image     Binary Mask (old)     Colored Mask (new)
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ 🐈 🌳 🌤️  │   │ ███ ░░░ ░░░ │   │ 🐈 ░░░ ░░░ │
│ 🐈 🌳 🌤️  │ → │ ███ ░░░ ░░░ │ → │ 🐈 ░░░ ░░░ │
│ ░ 🌳 🌤️   │   │ ░░░ ░░░ ░░░ │   │ ░ ░░░ ░░░ │
└─────────────┘   └─────────────┘   └─────────────┘
```

## Code Helpers

### Ensure Proper Data Types

```python
# Make sure mask values are in 0-1 range before applying
if masks_smooth.max() > 1.0:
    masks_smooth = masks_smooth / 255.0

# Make sure image is RGB (not BGR)
if len(image.shape) == 3 and image.shape[2] == 3:
    # Already RGB, good
    pass
else:
    raise ValueError(f"Image format unexpected: {image.shape}")
```

### Handle Different Mask Post-Processing

If your `post_process_mask` already returns binary 0-1:

```python
mask_3ch = np.stack([masks_smooth] * 3, axis=-1)
masked_image = (image * mask_3ch * 255).astype(np.uint8)  # Scale back to 0-255
```

If your `post_process_mask` returns 0-255:

```python
mask_3ch = np.stack([masks_smooth] * 3, axis=-1) / 255.0  # Normalize to 0-1
masked_image = (image * mask_3ch).astype(np.uint8)
```

### Optional: Add Alpha Channel for Transparency

If you want transparency instead of black background:

```python
# Create RGBA image
masked_rgba = np.zeros((image.shape[0], image.shape[1], 4), dtype=np.uint8)
masked_rgba[:, :, :3] = image  # RGB channels
masked_rgba[:, :, 3] = (masks_smooth * 255).astype(np.uint8)  # Alpha channel

# Encode as PNG (preserves transparency)
success, masked_png = cv2.imencode(".png", masked_rgba)
```

## Testing

After deploying the change:

1. **Visually inspect** the returned mask image:

   - Should show object colors where mask is white in binary version
   - Should show black elsewhere

2. **Verify file size** increased (due to more color data)

3. **Test with 3D generation** - the PLY should still generate correctly

## Performance Impact

- **Slightly slower:** Additional image multiplication operation (~1-5ms)
- **Larger response:** More color data than binary (~10x file size typically)
- **Same inference time:** SAM 2 inference unchanged

## Rollback

If needed, revert to binary masks by reverting this change. Frontend code doesn't need updates - it just displays whatever PNG is returned.
