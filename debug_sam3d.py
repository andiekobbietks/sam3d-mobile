#!/usr/bin/env python3
"""
Debugging script for spconv/SAM-3d-objects inference issues.
Run this directly on your backend to identify the problem.
"""

import sys

import numpy as np
import torch


def test_pytorch():
    """Test PyTorch installation"""
    print("=" * 60)
    print("PYTORCH CHECK")
    print("=" * 60)
    print(f"✓ PyTorch version: {torch.__version__}")
    print(f"✓ CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"✓ CUDA version: {torch.version.cuda}")
        print(f"✓ GPU: {torch.cuda.get_device_name(0)}")
        print(
            f"✓ GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB"
        )
    print()


def test_spconv():
    """Test spconv installation"""
    print("=" * 60)
    print("SPCONV CHECK")
    print("=" * 60)
    try:
        import spconv

        print(f"✓ spconv version: {spconv.__version__}")

        # Test spconv kernel creation
        try:
            x = torch.randn(1, 3, 32, 32, 32)
            if torch.cuda.is_available():
                x = x.cuda()
            # Create a simple sparse tensor
            indices = torch.randint(0, 32, (3, 10)).long()
            values = torch.randn(10)
            sparse_x = torch.sparse_coo_tensor(indices, values, (32, 32, 32))
            print("✓ spconv kernel creation OK")
        except Exception as e:
            print(f"✗ spconv kernel creation failed: {e}")
            return False
    except ImportError as e:
        print(f"✗ spconv not installed: {e}")
        return False
    print()
    return True


def test_sam3d_import():
    """Test SAM-3d-objects import"""
    print("=" * 60)
    print("SAM-3D IMPORT CHECK")
    print("=" * 60)
    try:
        from inference import Inference

        print("✓ Inference class imported successfully")
        return True
    except ImportError as e:
        print(f"✗ Failed to import Inference: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        return False


def test_model_loading(config_path):
    """Test model loading"""
    print("=" * 60)
    print("MODEL LOADING CHECK")
    print("=" * 60)
    print(f"Config path: {config_path}")

    try:
        from inference import Inference

        print("Loading model...")
        inference = Inference(config_path, compile=False)
        print("✓ Model loaded successfully")
        return inference
    except FileNotFoundError as e:
        print(f"✗ Config file not found: {config_path}")
        print(f"  Error: {e}")
        return None
    except Exception as e:
        print(f"✗ Failed to load model: {e}")
        import traceback

        traceback.print_exc()
        return None


def test_inference(inference, image_path, mask_path):
    """Test inference on real data"""
    print("=" * 60)
    print("INFERENCE TEST")
    print("=" * 60)

    try:
        import cv2
        from PIL import Image as PILImage

        # Load image
        if image_path.endswith(".png"):
            image = cv2.imread(image_path)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        else:
            image = np.array(PILImage.open(image_path))

        # Load mask
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        mask = (mask > 127).astype(np.uint8)

        print(f"Image shape: {image.shape}, dtype: {image.dtype}")
        print(f"Mask shape: {mask.shape}, unique: {np.unique(mask)}")

        # Run inference
        print("Running inference...")
        output = inference(image, mask, seed=42)
        print(f"✓ Inference successful!")
        print(f"✓ Output keys: {list(output.keys())}")
        return True

    except Exception as e:
        print(f"✗ Inference failed: {e}")
        import traceback

        traceback.print_exc()
        return False


def main():
    print("\nSAM-3D DEBUGGING SCRIPT")
    print("=" * 60)

    # Basic checks
    test_pytorch()
    if not test_spconv():
        print("\n❌ SPCONV CHECK FAILED - This is likely your issue!")
        print(
            "   Fix: pip uninstall spconv* torch* && pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118 && pip install spconv-cu118"
        )
        sys.exit(1)

    if not test_sam3d_import():
        print("\n❌ SAM-3D IMPORT FAILED")
        sys.exit(1)

    # Optional: test model loading
    config_path = input("\nEnter config path (or press Enter to skip): ").strip()
    if config_path:
        inference = test_model_loading(config_path)

        if inference:
            image_path = input(
                "Enter test image path (or press Enter to skip): "
            ).strip()
            mask_path = input("Enter test mask path (or press Enter to skip): ").strip()

            if image_path and mask_path:
                test_inference(inference, image_path, mask_path)

    print("\n" + "=" * 60)
    print("✓ DEBUGGING COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
