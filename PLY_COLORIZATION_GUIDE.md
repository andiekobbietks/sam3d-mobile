# PLY Colorization Guide for Sam-3d-objects

## Problem

Sam-3d-objects generates PLY files without color information. The generated 3D models appear white in the viewer.

## Solution

Add a post-processing step to the `/generate-3d-status/{task_id}` endpoint that colorizes the PLY based on the original image colors in the masked region.

## Backend Implementation

Add this to your FastAPI backend (in the same file with `/generate-3d` and `/generate-3d-status`):

```python
import struct
import io
import base64
import numpy as np
from PIL import Image
from typing import Tuple

def colorize_ply(ply_bytes: bytes, image_b64: str, mask_b64: str) -> bytes:
    """
    Add RGB color information to a PLY file based on image colors in masked region.

    Args:
        ply_bytes: Binary PLY data
        image_b64: Base64 encoded original image
        mask_b64: Base64 encoded segmentation mask

    Returns:
        Binary PLY data with RGB properties
    """
    try:
        # Decode image and mask
        image_data = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        image_array = np.array(image)

        mask_data = base64.b64decode(mask_b64)
        mask = Image.open(io.BytesIO(mask_data)).convert('L')
        mask_array = np.array(mask) > 0

        h, w = image_array.shape[:2]

        # Parse PLY header
        ply_text = ply_bytes.decode('utf-8', errors='ignore')
        header_end = ply_text.find('end_header')
        header_lines = ply_text[:header_end].split('\n')

        vertex_count = 0
        for line in header_lines:
            if line.startswith('element vertex'):
                vertex_count = int(line.split()[-1])

        # Find where binary data starts
        binary_start = len(ply_text[:header_end + len('end_header') + 1].encode('utf-8'))
        binary_data = ply_bytes[binary_start:]

        # Parse vertex positions
        vertices = []
        offset = 0
        for i in range(vertex_count):
            try:
                x = struct.unpack('<f', binary_data[offset:offset+4])[0]
                y = struct.unpack('<f', binary_data[offset+4:offset+8])[0]
                z = struct.unpack('<f', binary_data[offset+8:offset+12])[0]
                vertices.append((x, y, z))
                offset += 12
            except:
                # Skip malformed vertices
                continue

        # Sample colors from image
        # Use random sampling from masked region as fallback colors
        masked_pixels = np.argwhere(mask_array)

        colors = []
        for x, y, z in vertices:
            # Try to project vertex to 2D space
            # Normalize coordinates to [0, 1]
            norm_x = (x + 1) / 2 if x >= -1 else 0.5
            norm_y = (y + 1) / 2 if y >= -1 else 0.5

            # Convert to pixel coordinates with bounds checking
            img_x = int(norm_x * (w - 1))
            img_y = int(norm_y * (h - 1))

            # Strict bounds checking
            img_x = max(0, min(w - 1, img_x))
            img_y = max(0, min(h - 1, img_y))

            try:
                # Get color from image
                if mask_array[img_y, img_x]:
                    r, g, b = image_array[img_y, img_x][:3]
                else:
                    # Use random color from masked region if available
                    if len(masked_pixels) > 0:
                        idx = np.random.randint(len(masked_pixels))
                        py, px = masked_pixels[idx]
                        r, g, b = image_array[py, px][:3]
                    else:
                        r, g, b = 255, 255, 255

                # Ensure valid byte values
                r = int(max(0, min(255, r)))
                g = int(max(0, min(255, g)))
                b = int(max(0, min(255, b)))
                colors.append((r, g, b))
            except Exception as e:
                # Default to white on error
                colors.append((255, 255, 255))

        # Build new PLY with color
        new_header = []
        for line in header_lines:
            if line.strip():
                if not line.startswith('property'):
                    new_header.append(line)

        # Add vertex element and position properties
        new_header.insert(0, f'element vertex {len(vertices)}')
        new_header.insert(1, 'property float x')
        new_header.insert(2, 'property float y')
        new_header.insert(3, 'property float z')

        # Add color properties
        new_header.insert(4, 'property uchar red')
        new_header.insert(5, 'property uchar green')
        new_header.insert(6, 'property uchar blue')

        # Keep format and version at top
        new_ply = 'ply\n'
        new_ply += 'format binary_little_endian 1.0\n'

        for line in new_header:
            if line.strip() and not line.startswith('ply') and not line.startswith('format'):
                new_ply += line + '\n'

        new_ply += 'end_header\n'

        # Write vertex data with colors
        new_ply_bytes = new_ply.encode('utf-8')
        for i, (x, y, z) in enumerate(vertices):
            r, g, b = colors[i] if i < len(colors) else (255, 255, 255)
            vertex_bytes = struct.pack('<fff', float(x), float(y), float(z))
            vertex_bytes += struct.pack('<BBB', int(r), int(g), int(b))
            new_ply_bytes += vertex_bytes

        return new_ply_bytes

    except Exception as e:
        print(f"Error in colorize_ply: {e}")
        import traceback
        traceback.print_exc()
        # Return original PLY if colorization fails
        return ply_bytes
```

## Usage in `/generate-3d-status/{task_id}`

Update your status endpoint to colorize the PLY:

```python
@app.get("/generate-3d-status/{task_id}")
async def get_generate_3d_status(task_id: str):
    # ... existing status check code ...

    if task_result['status'] == 'completed':
        # Get the PLY bytes from your storage/cache
        ply_bytes = task_result['ply_bytes']  # raw binary

        # Colorize it
        try:
            colored_ply = colorize_ply(
                ply_bytes,
                task_data['image_b64'],
                task_data['mask_b64']
            )
            ply_b64 = base64.b64encode(colored_ply).decode()
        except Exception as e:
            print(f"Warning: PLY colorization failed: {e}")
            # Fall back to non-colorized PLY
            ply_b64 = base64.b64encode(ply_bytes).decode()

        return {
            "status": "completed",
            "progress": 100,
            "ply_b64": ply_b64
        }
```

## Alternative: Store image/mask with task

If the above doesn't work, modify `/generate-3d` to store the image and mask:

```python
@app.post("/generate-3d")
async def generate_3d(input_data: dict):
    image_b64 = input_data.get("image")
    mask_b64 = input_data.get("mask")
    seed = input_data.get("seed", 0)

    task_id = str(uuid.uuid4())

    # Store the input data for later colorization
    TASK_CACHE[task_id] = {
        'image_b64': image_b64,
        'mask_b64': mask_b64,
        'seed': seed,
        'created_at': time.time()
    }

    # Start background task
    background_tasks.add_task(
        run_sam3d_generation,
        task_id,
        image_b64,
        mask_b64,
        seed
    )

    return {"task_id": task_id}
```

## Notes

1. **Projection**: The `colorize_ply` function uses a simple 2D projection. You may need to adjust based on your specific 3D-to-2D mapping.

2. **Performance**: For large PLY files (25MB+), colorization may take a few seconds. Consider async processing.

3. **Fallback**: If colorization fails, the endpoint returns non-colorized PLY (white points).

4. **Memory**: Ensure sufficient RAM for processing large files and images simultaneously.

## Testing

After implementation:

1. Generate a 3D model from a colored segmentation
2. Check the PLY file properties in the viewer console
3. You should see: `Has colors: true` and actual RGB values in the color logs

If still white, check:

- Is the PLY actually receiving colored vertices?
- Is the projection mapping correct for your coordinate system?
- Are colors being clamped to [0, 255] range?
