export function screenToCanvas(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number } {
  const relativeX = clientX - canvasRect.left;
  const relativeY = clientY - canvasRect.top;

  const safeZoom = zoom <= 0 ? 1 : zoom;
  const canvasX = (relativeX - panX) / safeZoom;
  const canvasY = (relativeY - panY) / safeZoom;

  return { x: canvasX, y: canvasY };
}

export function canvasToImage(
  canvasX: number,
  canvasY: number,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } {
  const scaleX = canvasWidth > 0 ? imageWidth / canvasWidth : 1;
  const scaleY = canvasHeight > 0 ? imageHeight / canvasHeight : 1;

  const rawX = Math.round(canvasX * scaleX);
  const rawY = Math.round(canvasY * scaleY);

  const clampedX = Math.max(0, Math.min(imageWidth - 1, rawX));
  const clampedY = Math.max(0, Math.min(imageHeight - 1, rawY));

  return { x: clampedX, y: clampedY };
}

export function screenToImage(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  panX: number,
  panY: number,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } {
  const { x: cx, y: cy } = screenToCanvas(clientX, clientY, canvasRect, panX, panY, zoom);
  return canvasToImage(cx, cy, canvasWidth, canvasHeight, imageWidth, imageHeight);
}

export function imageToCanvas(
  imageX: number,
  imageY: number,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } {
  const scaleX = imageWidth > 0 ? canvasWidth / imageWidth : 1;
  const scaleY = imageHeight > 0 ? canvasHeight / imageHeight : 1;
  return {
    x: imageX * scaleX,
    y: imageY * scaleY
  };
}
