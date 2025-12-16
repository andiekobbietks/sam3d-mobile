# Backend Debugging for Mask Issues

Add this debug logging to your `/segment-binary` endpoint to see what's happening with the masks:

```python
@app.post("/segment-binary")
async def segment_image_binary(request: SegmentBinaryRequest):
    """
    Segment an image and return the mask as base64 encoded PNG.
    """
    try:
        if model is None or processor is None:
            return JSONResponse(
                status_code=500, content={"error": "Model not initialized"}
            )

        # Decode base64 image
        try:
            image_data = base64.b64decode(request.image)
        except Exception as e:
            return JSONResponse(
                status_code=400, content={"error": f"Invalid base64 image: {str(e)}"}
            )

        # Validate points
        if not request.points or len(request.points) == 0:
            return JSONResponse(
                status_code=400, content={"error": "At least one point required"}
            )

        # Process image
        image_pil = Image.open(io.BytesIO(image_data)).convert("RGB")

        print(f"\n=== BACKEND DEBUG ===")
        print(f"Number of points: {len(request.points)}")
        print(f"Points: {request.points}")
        print(f"Has previous_mask: {request.previous_mask is not None}")
        if request.previous_mask:
            print(f"Previous mask base64 length: {len(request.previous_mask)}")

        # Convert points to the format expected by SAM 2
        input_points = [[[[p["x"], p["y"]] for p in request.points]]]
        input_labels = [[[1] * len(request.points)]]

        print(f"Processing {len(request.points)} point(s)...")

        # Process inputs
        inputs = processor(
            images=image_pil,
            input_points=input_points,
            input_labels=input_labels,
            return_tensors="pt",
        ).to(device)

        # Handle previous mask
        mask_input = None
        if request.previous_mask:
            try:
                mask_data = base64.b64decode(request.previous_mask)
                prev_mask_pil = Image.open(io.BytesIO(mask_data)).convert("L")
                prev_mask_array = np.array(prev_mask_pil) > 127
                mask_input = torch.from_numpy(prev_mask_array).float().to(device)
                print(f"Previous mask loaded successfully")
                print(f"Previous mask shape: {mask_input.shape}")
                print(f"Previous mask unique values: {torch.unique(mask_input)}")
            except Exception as e:
                print(f"Warning: Could not load previous mask: {e}")
                mask_input = None

        # Run inference
        print(f"Running inference with mask_input={mask_input is not None}...")
        with torch.no_grad():
            if mask_input is not None:
                outputs = model(
                    **inputs,
                    mask_input=mask_input[None, None, :, :],
                )
            else:
                outputs = model(**inputs)

        # Post-process masks
        masks = processor.post_process_masks(
            outputs.pred_masks.cpu(), inputs["original_sizes"]
        )[0]

        print(f"Generated masks shape: {masks.shape}")

        # Get scores and find the mask with the highest score
        scores = (
            outputs.iou_preds[0].cpu().numpy()
            if hasattr(outputs, "iou_preds")
            else np.array([0.95] * masks.shape[0])
        )
        best_mask_idx = np.argmax(scores)
        print(f"Best mask index: {best_mask_idx}, score: {scores[best_mask_idx]}")

        mask = masks[best_mask_idx].numpy()
        # Squeeze extra dimensions and ensure 2D
        mask = np.squeeze(mask)
        if mask.ndim != 2:
            mask = mask[0] if mask.ndim > 2 else mask

        print(f"Mask shape before threshold: {mask.shape}")
        print(f"Mask value range: {mask.min():.3f} to {mask.max():.3f}")

        mask = (mask > request.mask_threshold).astype(np.uint8) * 255

        print(f"Mask unique values after threshold: {np.unique(mask)}")
        print(f"Mask coverage: {(mask > 0).sum() / mask.size * 100:.1f}%")

        # Apply morphological smoothing
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
        mask = cv2.GaussianBlur(mask, (5, 5), 0)
        mask = (mask > 127).astype(np.uint8) * 255

        print(f"Mask coverage after smoothing: {(mask > 0).sum() / mask.size * 100:.1f}%")

        # Convert to PNG and encode as base64
        mask_image = Image.fromarray(mask, mode="L")
        buffer = io.BytesIO()
        mask_image.save(buffer, format="PNG")
        mask_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        print(f"Output mask base64 length: {len(mask_base64)}")
        print(f"=== END DEBUG ===\n")

        score = float(scores[best_mask_idx])

        return JSONResponse(
            {
                "success": True,
                "mask": mask_base64,
                "score": score,
            }
        )

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=400, content={"error": str(e)})
```

## What to Look For

**Frontend logs:**

- `hasPreviousMask`: Should be `true` on tap 2+
- `Previous mask base64 length`: Should be > 0 when mask is sent
- Compare new mask length to previous

**Backend logs:**

- `Has previous_mask`: Should be `true` on tap 2+
- `Previous mask loaded successfully`: Confirms it was decoded properly
- `Mask unique values` before/after: Shows if mask is being modified
- `Mask coverage %`: Compare percentages - should stay same or increase

If `Mask coverage` is decreasing, the issue is in how SAM 2 is using the previous mask input.
