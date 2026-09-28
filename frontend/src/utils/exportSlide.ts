import { RegionObject } from '../types/region';
import { VectorSelection, Point2D } from '../types/segmentation';
import { loadImageAsync } from './canvas';
import { computePolygonBBox } from './vectorMath';

export interface ExportSlideOptions {
  colorMode: 'vibrant_yellow' | 'region_colors' | 'custom';
  customColor?: string;
  lineWidth: number; // e.g. 2, 3, 4
  showLabels: 'none' | 'numbers_only' | 'full_names';
  includeMetadataFooter?: boolean;
  slideName?: string;
  clinicalContext?: string;
  format: 'png' | 'jpeg';
  quality?: number;
}

export const DEFAULT_EXPORT_OPTIONS: ExportSlideOptions = {
  colorMode: 'vibrant_yellow',
  customColor: '#facc15',
  lineWidth: 2.5,
  showLabels: 'none',
  includeMetadataFooter: false,
  format: 'png',
  quality: 0.95,
};

/**
 * Generates an HTML5 Canvas element with the original full-resolution slide image
 * and all marked vector ROI regions / shapes drawn over it.
 */
export async function generateAnnotatedSlideCanvas(
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  regions: RegionObject[],
  activeVectorSelection: VectorSelection | null,
  activeRegionId: string,
  options: ExportSlideOptions
): Promise<HTMLCanvasElement> {
  const img = await loadImageAsync(imageUrl);

  const footerHeight = options.includeMetadataFooter ? 48 : 0;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, imageWidth);
  canvas.height = Math.max(1, imageHeight + footerHeight);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D rendering context for export canvas');

  // 1. Draw Original Slide Image (100% Full Resolution)
  ctx.imageSmoothingEnabled = false;
  (ctx as any).mozImageSmoothingEnabled = false;
  (ctx as any).webkitImageSmoothingEnabled = false;
  (ctx as any).msImageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, imageWidth, imageHeight);

  // 2. Aggregate all valid marked regions
  const allShapes: Array<{
    id: string;
    name: string;
    category: string;
    color: string;
    points: Point2D[];
    index: number;
  }> = [];

  let validIdx = 1;
  for (const reg of regions) {
    let pts: Point2D[] | null = null;
    if (reg.id === activeRegionId && activeVectorSelection?.points && activeVectorSelection.points.length >= 3) {
      pts = activeVectorSelection.points;
    } else if (reg.vectorSelection?.points && reg.vectorSelection.points.length >= 3) {
      pts = reg.vectorSelection.points;
    }

    if (pts && pts.length >= 3) {
      allShapes.push({
        id: reg.id,
        name: reg.name,
        category: reg.category,
        color: reg.color || '#facc15',
        points: pts,
        index: validIdx++,
      });
    }
  }

  // 3. Draw Each Annotated Shape / Mark
  for (const shape of allShapes) {
    let strokeColor = '#facc15'; // Default vibrant gold/yellow
    if (options.colorMode === 'region_colors') {
      strokeColor = shape.color;
    } else if (options.colorMode === 'custom' && options.customColor) {
      strokeColor = options.customColor;
    }

    const pts = shape.points;

    ctx.save();
    // High-visibility crisp stroke
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1.5, options.lineWidth);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Optional Label / Numbered Badge
    if (options.showLabels !== 'none') {
      const [minX, minY, maxX] = computePolygonBBox(pts);
      const centerX = (minX + maxX) / 2;
      const topY = minY;

      const labelText = options.showLabels === 'numbers_only'
        ? `${shape.index}`
        : `#${shape.index} ${shape.name || shape.category}`;

      ctx.save();
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const padX = 6;
      const padY = 3;
      const pillW = textMetrics.width + padX * 2;
      const pillH = 18;
      const pillX = Math.max(4, Math.min(imageWidth - pillW - 4, centerX - pillW / 2));
      const pillY = Math.max(4, topY - pillH - 4);

      // Dark background pill with colored border
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
      ctx.fill();
      ctx.stroke();

      // Text
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, pillX + pillW / 2, pillY + pillH / 2);
      ctx.restore();
    }
  }

  // 4. Optional Metadata Footer Bar
  if (options.includeMetadataFooter) {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, imageHeight, imageWidth, footerHeight);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, imageHeight);
    ctx.lineTo(imageWidth, imageHeight);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const leftText = `ORAL HISTOPATHOLOGY MANUAL ROI MARKS | Slide: ${options.slideName || 'Slide'}`;
    ctx.fillText(leftText, 16, imageHeight + footerHeight / 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const rightText = `Marked ROIs: ${allShapes.length} | Exported: ${new Date().toLocaleDateString()}`;
    ctx.fillText(rightText, imageWidth - 16, imageHeight + footerHeight / 2);
    ctx.restore();
  }

  return canvas;
}

/**
 * Triggers a browser download of the full annotated slide image.
 */
export async function downloadAnnotatedSlide(
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  regions: RegionObject[],
  activeVectorSelection: VectorSelection | null,
  activeRegionId: string,
  options: Partial<ExportSlideOptions> = {}
): Promise<string> {
  const mergedOptions: ExportSlideOptions = {
    ...DEFAULT_EXPORT_OPTIONS,
    ...options,
  };

  const canvas = await generateAnnotatedSlideCanvas(
    imageUrl,
    imageWidth,
    imageHeight,
    regions,
    activeVectorSelection,
    activeRegionId,
    mergedOptions
  );

  const mimeType = mergedOptions.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext = mergedOptions.format === 'jpeg' ? 'jpg' : 'png';
  const sanitizedName = (mergedOptions.slideName || 'histopath_slide')
    .replace(/[^a-z0-9_-]/gi, '_')
    .toLowerCase();
  const filename = `${sanitizedName}_annotated_${Date.now()}.${ext}`;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to generate image blob from canvas'));
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 5000);
        resolve(filename);
      },
      mimeType,
      mergedOptions.quality || 0.95
    );
  });
}
