import io
import base64
from typing import Tuple, Optional
import numpy as np
from PIL import Image
import cv2

def base64_to_numpy_mask(base64_str: str, target_shape: Optional[Tuple[int, int]] = None) -> np.ndarray:
    """
    Decodes a base64 encoded PNG/JPEG mask into a 2D uint8 numpy array (0 or 255).
    """
    if not base64_str:
        if target_shape:
            return np.zeros(target_shape, dtype=np.uint8)
        return np.zeros((1, 1), dtype=np.uint8)

    # Clean base64 header if present (e.g. data:image/png;base64,...)
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]

    img_data = base64.b64decode(base64_str)
    pil_img = Image.open(io.BytesIO(img_data))
    arr = np.array(pil_img)

    # If RGBA, take alpha channel or red channel
    if arr.ndim == 3:
        if arr.shape[2] == 4:
            mask = arr[:, :, 3]  # Alpha channel
            # If alpha is full or empty, check RGB
            if np.count_nonzero(mask) == 0 or np.all(mask == 255):
                mask = np.max(arr[:, :, :3], axis=2)
        else:
            mask = np.max(arr, axis=2)
    else:
        mask = arr

    binary_mask = (mask > 10).astype(np.uint8) * 255

    if target_shape is not None and binary_mask.shape[:2] != target_shape:
        binary_mask = cv2.resize(binary_mask, (target_shape[1], target_shape[0]), interpolation=cv2.INTER_NEAREST)

    return binary_mask


def numpy_mask_to_base64(mask: np.ndarray) -> str:
    """
    Encodes a 2D numpy mask (0 or 255) to a base64 PNG data URL.
    """
    if mask.dtype != np.uint8:
        mask = (mask > 0).astype(np.uint8) * 255
    pil_img = Image.fromarray(mask, mode="L")
    buffered = io.BytesIO()
    pil_img.save(buffered, format="PNG")
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_b64}"


def numpy_image_to_base64(image_rgb: np.ndarray, format_type: str = "PNG") -> str:
    """
    Encodes an RGB or RGBA numpy image to base64 data URL.
    """
    if image_rgb.ndim == 3 and image_rgb.shape[2] == 4:
        pil_img = Image.fromarray(image_rgb, mode="RGBA")
    elif image_rgb.ndim == 3:
        pil_img = Image.fromarray(image_rgb, mode="RGB")
    else:
        pil_img = Image.fromarray(image_rgb, mode="L")

    buffered = io.BytesIO()
    pil_img.save(buffered, format=format_type)
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    mime = "image/png" if format_type.upper() == "PNG" else "image/jpeg"
    return f"data:{mime};base64,{img_b64}"
