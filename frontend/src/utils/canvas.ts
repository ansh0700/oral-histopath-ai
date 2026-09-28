import { BrushStroke, Point2D } from '../types/segmentation';

// Reusable scratch canvas to avoid garbage collection churn
let _scratchCanvas: HTMLCanvasElement | null = null;
function getScratchCanvas(width: number, height: number): HTMLCanvasElement {
  if (!_scratchCanvas) {
    _scratchCanvas = document.createElement('canvas');
  }
  if (_scratchCanvas.width !== width || _scratchCanvas.height !== height) {
    _scratchCanvas.width = Math.max(1, width);
    _scratchCanvas.height = Math.max(1, height);
  }
  return _scratchCanvas;
}

/**
 * Loads an image or base64 data URL asynchronously.
 * Uses createImageBitmap when supported for GPU-accelerated decoding.
 */
export async function loadImageAsync(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Creates an offscreen mask canvas of exact image dimensions.
 */
export function createOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.clearRect(0, 0, width, height);
  }
  return canvas;
}

/**
 * Draws a base64 or Image mask onto a target mask canvas.
 */
export async function loadMaskOntoCanvas(
  targetCanvas: HTMLCanvasElement,
  maskSrc: string,
  width: number,
  height: number
): Promise<void> {
  if (!maskSrc || width <= 0 || height <= 0) return;
  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  targetCanvas.width = width;
  targetCanvas.height = height;
  ctx.clearRect(0, 0, width, height);

  try {
    const img = await loadImageAsync(maskSrc);
    ctx.drawImage(img, 0, 0, width, height);
  } catch (err) {
    console.error('Failed to load mask onto canvas:', err);
  }
}

/**
 * Applies an ADD or ERASE brush stroke segment directly to the mask canvas in image coordinates.
 */
export function applyBrushSegmentToMaskCanvas(
  maskCanvas: HTMLCanvasElement,
  fromPoint: Point2D,
  toPoint: Point2D,
  mode: 'ADD' | 'ERASE',
  brushSize: number
): void {
  const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = brushSize;

  if (mode === 'ERASE') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(34, 197, 94, 1.0)';
    ctx.fillStyle = 'rgba(34, 197, 94, 1.0)';
  }

  ctx.beginPath();
  ctx.moveTo(fromPoint.x, fromPoint.y);
  ctx.lineTo(toPoint.x, toPoint.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(toPoint.x, toPoint.y, brushSize / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Extracts the non-zero bounding box and area from a mask canvas.
 */
export function getMaskCanvasStats(
  maskCanvas: HTMLCanvasElement
): { bbox: [number, number, number, number]; areaPixels: number } {
  const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
  const w = maskCanvas.width;
  const h = maskCanvas.height;
  if (!ctx || w === 0 || h === 0) {
    return { bbox: [0, 0, 0, 0], areaPixels: 0 };
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  let area = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const alpha = data[idx + 3];
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      if (alpha > 20 && (r > 10 || g > 10 || b > 10)) {
        area++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (area === 0) {
    return { bbox: [0, 0, 0, 0], areaPixels: 0 };
  }

  return {
    bbox: [minX, minY, maxX, maxY],
    areaPixels: area,
  };
}

/**
 * Converts a mask canvas to standard binary Base64 mask URL (255 inside, 0 outside).
 */
export function exportBinaryMaskBase64(maskCanvas: HTMLCanvasElement): string {
  const w = maskCanvas.width;
  const h = maskCanvas.height;
  const binCanvas = getScratchCanvas(w, h);
  const binCtx = binCanvas.getContext('2d', { willReadFrequently: true });
  const srcCtx = maskCanvas.getContext('2d', { willReadFrequently: true });

  if (!binCtx || !srcCtx || w === 0 || h === 0) {
    return '';
  }

  const srcData = srcCtx.getImageData(0, 0, w, h);
  const binData = binCtx.createImageData(w, h);

  for (let i = 0; i < srcData.data.length; i += 4) {
    const alpha = srcData.data[i + 3];
    const r = srcData.data[i];
    const g = srcData.data[i + 1];
    const b = srcData.data[i + 2];

    const isForeground = alpha > 20 && (r > 10 || g > 10 || b > 10);
    const val = isForeground ? 255 : 0;

    binData.data[i] = val;
    binData.data[i + 1] = val;
    binData.data[i + 2] = val;
    binData.data[i + 3] = 255;
  }

  binCtx.putImageData(binData, 0, 0);
  return binCanvas.toDataURL('image/png');
}

/**
 * Rasterizes an array of BrushStrokes onto an offscreen canvas of the exact original image resolution (W x H)
 */
export function rasterizeStrokesToMask(
  strokes: BrushStroke[],
  imageWidth: number,
  imageHeight: number,
  modeFilter?: 'ADD' | 'ERASE'
): string {
  const canvas = getScratchCanvas(imageWidth, imageHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return '';
  }

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, imageWidth, imageHeight);

  const targetStrokes = modeFilter ? strokes.filter((s) => s.mode === modeFilter) : strokes;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of targetStrokes) {
    if (stroke.points.length === 0) continue;

    ctx.strokeStyle = stroke.mode === 'ADD' ? '#ffffff' : '#000000';
    ctx.lineWidth = stroke.size;

    ctx.beginPath();
    const first = stroke.points[0];
    ctx.moveTo(first.x, first.y);

    if (stroke.points.length === 1) {
      ctx.arc(first.x, first.y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    } else {
      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
  }

  return canvas.toDataURL('image/png');
}
