# SAM 3D Objects Backend Integration Guide

This guide explains how to add the `/generate-3d` endpoint to your backend to integrate Sam-3d-objects for 3D object generation from segmented masks.

## Overview

The frontend now sends:

- **image** (base64 PNG) - The original image
- **mask** (base64 PNG) - Binary segmentation mask from SAM 2
- **seed** (integer, default 42) - Random seed for reproducibility

The backend should:

1. Decode the image and mask
2. Load the Sam-3d-objects model
3. Run inference to generate Gaussian splat representation
4. Export as PLY file
5. Return PLY as base64 or URL

## Implementation

### 1. Install Dependencies

```bash
# Install PyTorch with CUDA support (adjust cuda version for your system)
# For CUDA 11.8:
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Install spconv separately with prebuilt wheels (avoids compilation issues)
pip install spconv-cu118  # Or spconv-cu121 for CUDA 12.1

# Install Sam-3d-objects from source
git clone https://github.com/Anything-of-anything/SAM-3D
cd SAM-3D
pip install -e .

# Verify installation
python -c "import spconv; print(f'spconv version: {spconv.__version__}')"
python -c "import torch; print(f'PyTorch version: {torch.__version__}')"
```

**Important:** Make sure PyTorch, torchvision, and spconv are all compiled for the **same CUDA version**.

### 2. Add Model Loading (in your main backend file)

```python
import torch
import numpy as np
from PIL import Image
import io
import base64
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from inference import Inference, load_image, load_mask

# Global model instance (load once at startup)
sam3d_inference = None

@app.on_event("startup")
async def load_models():
    global sam3d_inference
    # Adjust path based on your checkpoint location
    config_path = "/path/to/checkpoints/pipeline.yaml"
    sam3d_inference = Inference(config_path, compile=False)
    print("Sam-3d-objects model loaded")
```

### 3. Create Request Model

```python
class Generate3dRequest(BaseModel):
    image: str  # base64 PNG
    mask: str   # base64 PNG binary mask
    seed: int = 42
```

### 4. Implement the Endpoint

```python
@app.post("/generate-3d")
async def generate_3d(request: Generate3dRequest):
    """
    Generate 3D object from image and segmentation mask.

    Returns:
    - success: bool
    - ply_b64: str (base64 encoded PLY file) OR
    - ply_url: str (URL to PLY file if saving to storage)
    - error: str (if failed)
    """
    try:
        if sam3d_inference is None:
            raise Exception("Model not loaded")

        # Decode image
        image_bytes = base64.b64decode(request.image)
        image_pil = Image.open(io.BytesIO(image_bytes))
        image = np.array(image_pil.convert("RGB"))

        print(f"Image shape: {image.shape}")

        # Decode mask
        mask_bytes = base64.b64decode(request.mask)
        mask_pil = Image.open(io.BytesIO(mask_bytes))
        mask = np.array(mask_pil.convert("L"))  # Convert to grayscale

        # Normalize mask to 0-1 range
        mask = (mask > 127).astype(np.uint8)

        print(f"Mask shape: {mask.shape}, unique values: {np.unique(mask)}")
        print(f"Mask coverage: {mask.sum() / mask.size * 100:.2f}%")

        # Set seed for reproducibility
        torch.manual_seed(request.seed)
        np.random.seed(request.seed)

        # Run inference
        print("Running Sam-3d-objects inference...")
        output = sam3d_inference(image, mask, seed=request.seed)

        print("Inference complete")
        print(f"Output keys: {output.keys()}")

        # Export as PLY (Gaussian splat)
        print("Exporting Gaussian splat as PLY...")
        ply_buffer = io.BytesIO()
        output["gs"].save_ply(ply_buffer.name)  # Adjust based on actual API

        # Alternative: save to disk then read
        ply_path = f"/tmp/output_{request.seed}.ply"
        output["gs"].save_ply(ply_path)

        with open(ply_path, "rb") as f:
            ply_bytes = f.read()

        ply_b64 = base64.b64encode(ply_bytes).decode("utf-8")

        return {
            "success": True,
            "ply_b64": ply_b64,
            # Alternatively, upload to cloud storage and return URL:
            # "ply_url": upload_to_storage(ply_bytes)
        }

    except Exception as e:
        print(f"Error in 3D generation: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }
```

## Notes

### Model Loading

- The model is large (~2-3GB), so load it once at startup, not per request
- Use a global instance to avoid reloading

### Mask Format

- SAM 2 outputs masks as 0-1 float (0=background, 1=foreground)
- Threshold at 0.5 and convert to binary (0-1 uint8) for Sam-3d-objects
- Ensure mask shape matches image dimensions

### Output Options

Choose one based on your infrastructure:

**Option 1: Return PLY as Base64**

```python
"ply_b64": base64.b64encode(ply_bytes).decode()
```

Frontend reconstructs: `data:model/ply;base64,${ply_b64}`

**Option 2: Return URL**

```python
# Upload to S3, Azure Blob, etc.
url = upload_to_cloud_storage(ply_bytes, f"models/{uuid}.ply")
return {"ply_url": url}
```

### Performance Optimization

- Inference typically takes 10-30 seconds
- Consider using RunPod serverless with long timeout (60+ seconds)
- Add progress tracking if frontend needs status updates

### Error Handling

Handle these common issues:

- Invalid base64: Catch `binascii.Error`
- Image/mask mismatch: Check dimensions match
- Out of memory: Reduce image resolution or use smaller model variant
- Model loading: Ensure checkpoints are accessible

## Testing

```bash
# Test with sample image and mask
curl -X POST http://localhost:8001/generate-3d \
  -H "Content-Type: application/json" \
  -d '{
    "image": "'$(cat encoded_image.txt)'",
    "mask": "'$(cat encoded_mask.txt)'",
    "seed": 42
  }'
```

## Troubleshooting: spconv Errors

### Error: "can't find suitable algorithm for 0"

This happens when spconv can't find a compatible kernel. **Solutions:**

#### 1. Check CUDA/PyTorch Compatibility

```bash
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
python -c "import torch; print(f'CUDA version: {torch.version.cuda}')"
python -c "import spconv; print(f'spconv version: {spconv.__version__}')"
```

#### 2. Reinstall with Correct CUDA Version

First, remove old installations:

```bash
pip uninstall torch torchvision spconv spconv-cu118 spconv-cu121 -y
```

Then install matching versions:

```bash
# For CUDA 11.8
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install spconv-cu118

# OR for CUDA 12.1
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install spconv-cu121
```

#### 3. Run on CPU if GPU Issues Persist

Add `device="cpu"` to inference:

```python
output = sam3d_inference(image, mask, seed=request.seed)  # Uses device set at load
```

Or modify inference loading:

```python
sam3d_inference = Inference(config_path, compile=False)
# Force CPU (slower but works)
sam3d_inference.model.to("cpu")
```

#### 4. Reduce Input Resolution

If CUDA OOM or algorithm issues:

```python
# Resize image to smaller resolution before inference
MAX_SIZE = 512
if max(image.shape[:2]) > MAX_SIZE:
    scale = MAX_SIZE / max(image.shape[:2])
    image = cv2.resize(image, None, fx=scale, fy=scale)
    mask = cv2.resize(mask, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
```

#### 5. Check Mask/Image Dimensions

Add validation:

```python
# Mask and image must have same spatial dimensions
if mask.shape[:2] != image.shape[:2]:
    mask = cv2.resize(mask, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_NEAREST)
    print(f"Resized mask to match image: {mask.shape}")

# Ensure image is RGB
if image.shape[2] != 3:
    print(f"Warning: Image has {image.shape[2]} channels, expected 3")
```

#### 6. Test Inference Directly

```python
# In your backend, test without API
import torch
import cv2
from PIL import Image
from inference import Inference

# Load model
config_path = "/path/to/checkpoints/pipeline.yaml"
inference = Inference(config_path, compile=False)

# Load test image and mask
image = cv2.imread("test_image.png")
image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
mask = cv2.imread("test_mask.png", cv2.IMREAD_GRAYSCALE)
mask = (mask > 127).astype(np.uint8)

print(f"Image: {image.shape}, dtype: {image.dtype}")
print(f"Mask: {mask.shape}, unique: {np.unique(mask)}")

try:
    output = inference(image, mask, seed=42)
    print("✓ Inference successful!")
    print(f"Output keys: {output.keys()}")
except Exception as e:
    print(f"✗ Inference failed: {e}")
```

If direct test fails, the issue is spconv/PyTorch incompatibility. If it works but API fails, check:

- Base64 encoding/decoding
- Tensor conversion
- Memory management

### Error: "CUDA out of memory"

```python
# Clear cache and reduce batch size
torch.cuda.empty_cache()

# Or process on CPU (slower)
@app.post("/generate-3d")
async def generate_3d(request: Generate3dRequest):
    device = "cpu"  # Force CPU
    # ... rest of implementation
```

### Error: "Model not found" or "Checkpoint not accessible"

```bash
# Verify checkpoint path
ls -la /path/to/checkpoints/pipeline.yaml

# If in container/RunPod, ensure volume is mounted
# Add to Dockerfile or startup:
ENV SAM3D_CHECKPOINTS="/workspace/checkpoints"
```

## Frontend Integration

After implementing the endpoint:

1. Frontend sends segmentation mask to `/generate-3d`
2. Backend generates PLY and returns base64 or URL
3. Frontend navigates to viewer with `data:model/ply;base64,...` or URL
4. Viewer renders the 3D model using Three.js or similar

The flow is:

```
Image → SAM 2 (/segment-binary) → Mask → Sam-3d-objects (/generate-3d) → PLY → Viewer
```
