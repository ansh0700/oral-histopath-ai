import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Target,
  Layers,
  Hand,
  Scissors,
  Circle,
  Waves,
  Sparkles,
  Edit3,
  CheckCircle2,
  Trash2,
  PlusCircle,
  XCircle,
  Crop,
  Check,
  Download,
  Eraser,
  Paintbrush
} from 'lucide-react';
import { BrushMode, VectorSelection, Point2D, LineStyle } from '../types/segmentation';
import { RegionObject } from '../types/region';
import { screenToImage } from '../utils/coordinates';
import {
  loadImageAsync,
  createOffscreenCanvas,
  loadMaskOntoCanvas,
  applyBrushSegmentToMaskCanvas,
  getMaskCanvasStats,
  exportBinaryMaskBase64,
} from '../utils/canvas';
import {
  computePolygonBBox,
  computeBBoxCenter,
  computeCombinedBBox,
  calculateFitTransform,
  isPointInPolygon,
  translatePolygon,
  rasterizePolygonToBinaryMask,
  calculatePolygonAreaPixels,
  findClosestVertex,
  findClosestEdge,
  insertVertex,
  deleteVertex,
  smoothPolygon,
  elasticDeformPolygon,
  spliceReshapeStroke,
  createEllipsePoints,
  distance,
  erasePolygonVerticesInRadius,
  trimPolygonSpikesAndLoops,
  removeSelfIntersectionsAndLoops,
  expandPolygonWithRadius,
  mergePolygonWithStroke,
  unionPolygonWithCircle,
  subtractCircleFromPolygon,
} from '../utils/vectorMath';

function drawRegionBadgeOnCanvas(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number }>,
  label: string,
  color: string,
  isActive: boolean,
  zoom: number,
  imageWidth: number
) {
  if (!pts || pts.length < 3) return;
  let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x < minX) minX = pts[i].x;
    if (pts[i].x > maxX) maxX = pts[i].x;
    if (pts[i].y < minY) minY = pts[i].y;
  }
  const centerX = (minX + maxX) / 2;

  ctx.save();
  const fontSize = Math.max(10, Math.min(14, 12 / Math.sqrt(zoom)));
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
  const textMetrics = ctx.measureText(label);
  const padX = Math.max(4, 6 / Math.sqrt(zoom));
  const padY = Math.max(2, 3 / Math.sqrt(zoom));
  const pillW = textMetrics.width + padX * 2;
  const pillH = fontSize + padY * 2;
  const pillX = Math.max(4, Math.min(imageWidth - pillW - 4, centerX - pillW / 2));
  const pillY = Math.max(4, minY - pillH - 4);

  ctx.fillStyle = isActive ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.0, (isActive ? 1.8 : 1.2) / zoom);
  ctx.beginPath();
  const radius = Math.min(4, pillH / 2);
  if ((ctx as any).roundRect) {
    (ctx as any).roundRect(pillX, pillY, pillW, pillH, radius);
  } else {
    ctx.rect(pillX, pillY, pillW, pillH);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isActive ? '#ffffff' : '#e2e8f0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pillX + padX, pillY + pillH / 2);
  ctx.restore();
}

export interface ImageViewerRef {
  addPointAtSelection: () => void;
  deleteSelectedPoint: () => void;
  smoothCurrentContour: () => void;
  trimSpikes: () => void;
}

interface ImageViewerProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  mode: BrushMode;
  setMode?: (mode: BrushMode) => void;
  brushSize: number;
  setBrushSize?: (size: number) => void;
  strokeWidth?: number;
  setStrokeWidth?: (width: number) => void;
  lineStyle?: LineStyle;
  maskOpacity: number;
  showOriginal: boolean;
  isConfirmed?: boolean;
  onMaskUpdate?: (newMaskB64: string, newBbox: [number, number, number, number], areaPixels: number) => void;
  vectorSelection?: VectorSelection | null;
  onVectorSelectionChange?: (selection: VectorSelection | null, rasterMaskB64?: string) => void;
  onConfirmSelection?: () => void;
  onExtractRegion?: () => void;
  // Multi-Region & Focus props
  regions?: RegionObject[];
  activeRegionId?: string;
  onSelectRegion?: (id: string) => void;
  onAddNewRegionWithSelection?: (selection: VectorSelection, rasterMaskB64?: string) => void;
  onExportAnnotatedSlide?: () => void;
  focusTrigger?: number;
  showAllTrigger?: number;
  selectedVertexIndex: number | null;
  setSelectedVertexIndex: (idx: number | null) => void;
}

const BOUNDARY_COLORS = [
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Orange', hex: '#f97316' },
];

export const ImageViewer = forwardRef<ImageViewerRef, ImageViewerProps>(({
  imageUrl,
  imageWidth,
  imageHeight,
  mode,
  setMode,
  brushSize,
  setBrushSize,
  strokeWidth = 1.5,
  setStrokeWidth,
  lineStyle = 'dotted',
  maskOpacity,
  showOriginal,
  isConfirmed = false,
  onMaskUpdate,
  vectorSelection,
  onVectorSelectionChange,
  onConfirmSelection,
  onExtractRegion,
  regions = [],
  activeRegionId,
  onSelectRegion,
  onAddNewRegionWithSelection,
  onExportAnnotatedSlide,
  focusTrigger = 0,
  showAllTrigger = 0,
  selectedVertexIndex,
  setSelectedVertexIndex,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Synchronous Camera Reference for 60 FPS Zero-Latency Zoom & Pan
  const cameraRef = useRef<{ zoom: number; pan: Point2D }>({
    zoom: 1.0,
    pan: { x: 0, y: 0 },
  });

  // UI State for Display Only
  const [displayZoom, setDisplayZoom] = useState<number>(1.0);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<Point2D>({ x: 0, y: 0 });

  // Confirmed Boundary Color Customization
  const [confirmedBoundaryColor, setConfirmedBoundaryColor] = useState<string>('#10b981');
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [sharpMode, setSharpMode] = useState<boolean>(true); // Crisp HD pixel rendering without blur

  // 1. FREEHAND & RESHAPE DRAWING REFS
  const isDrawingFreehandRef = useRef<boolean>(false);
  const freehandPointsRef = useRef<Point2D[]>([]);

  // 2. CIRCLE / ELLIPSE CREATION REFS
  const circleStartImgRef = useRef<Point2D | null>(null);
  const circleCurrentImgRef = useRef<Point2D | null>(null);

  // 3. VECTOR BOUNDARY POINTS REFS
  const activeVectorPointsRef = useRef<Point2D[] | null>(vectorSelection?.points || null);
  const activeInteractionRef = useRef<{
    type: 'none' | 'vertex' | 'move' | 'elastic_sculpt' | 'stroke_reshape';
    vertexIndex?: number;
    grabPoint?: Point2D;
  }>({ type: 'none' });
  const dragStartImgRef = useRef<Point2D | null>(null);
  const initialPointsAtDragRef = useRef<Point2D[] | null>(null);

  // Hovered vertex, edge, and region indicators
  const [hoveredVertexIndex, setHoveredVertexIndex] = useState<number | null>(null);
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState<number | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>('crosshair');

  // Click vs Drag tracking for instant region selection on canvas click
  const pointerDownScreenPosRef = useRef<Point2D | null>(null);
  const hasDraggedSignificantDistanceRef = useRef<boolean>(false);

  // Brush drawing state (for ADD & ERASE modes)
  const isBrushingRef = useRef<boolean>(false);
  const lastBrushPointRef = useRef<{ x: number; y: number } | null>(null);
  const mousePosRef = useRef<Point2D | null>(null);
  const mouseImgPosRef = useRef<Point2D | null>(null);

  // Background Image & Offscreen Mask Canvas
  const imgElementRef = useRef<HTMLImageElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(createOffscreenCanvas(imageWidth || 1, imageHeight || 1));
  const activeMaskVersionRef = useRef<string | null>(null);

  // Synchronize incoming vectorSelection prop
  useEffect(() => {
    if (activeInteractionRef.current.type === 'none') {
      activeVectorPointsRef.current = vectorSelection?.points || null;
      renderCanvas();
    }
  }, [vectorSelection]);

  // MAIN CANVAS RENDER FUNCTION
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    const { zoom, pan } = cameraRef.current;

    ctx.clearRect(0, 0, cw, ch);
    ctx.save();

    // 1. Camera Viewport Transform (Zoom & Pan)
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // LAYER 1: Original High-Resolution Histopathology Slide Image (With Crisp HD Pixel Mode)
    if (showOriginal && imgElementRef.current) {
      ctx.imageSmoothingEnabled = !sharpMode;
      (ctx as any).mozImageSmoothingEnabled = !sharpMode;
      (ctx as any).webkitImageSmoothingEnabled = !sharpMode;
      (ctx as any).msImageSmoothingEnabled = !sharpMode;
      ctx.drawImage(imgElementRef.current, 0, 0, imageWidth, imageHeight);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, imageWidth, imageHeight);
    }

    // LAYER 2: Other Non-Active Multi-Region Outlines (Crisp, Razor-Sharp Solid Outlines)
    if (regions && regions.length > 0) {
      for (let rIdx = 0; rIdx < regions.length; rIdx++) {
        const reg = regions[rIdx];
        if (reg.id === activeRegionId) continue;
        const rPts = reg.vectorSelection?.points;
        if (rPts && rPts.length >= 3) {
          ctx.save();
          const regColor = reg.color || '#22c55e';
          const isHovered = hoveredRegionId === reg.id;

          // Pure Solid Crisp Outline - Zero dark blur underlay, zero fill haze
          ctx.strokeStyle = isHovered ? '#ffffff' : regColor;
          ctx.lineWidth = isHovered
            ? Math.max(1.5, (strokeWidth + 0.6) / zoom)
            : Math.max(0.8, strokeWidth / zoom);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(rPts[0].x, rPts[0].y);
          for (let i = 1; i < rPts.length; i++) {
            ctx.lineTo(rPts[i].x, rPts[i].y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }
      }
    }



    // LAYER 4: ACTIVE SELECTION BOUNDARY (Crisp, Razor-Sharp Solid Outline, 100% Clear Interior)
    const pts = activeVectorPointsRef.current;
    if (pts && pts.length >= 3) {
      const activeLineColor = isConfirmed
        ? confirmedBoundaryColor
        : mode === 'RESHAPE'
        ? '#14b8a6'
        : '#38bdf8';

      // 100% Clear Interior - Zero fill haze/tint covering tissue cells
      // Pure Crisp Solid Line - Zero blur, zero halo, zero shadow
      ctx.save();
      ctx.strokeStyle = activeLineColor;
      ctx.lineWidth = Math.max(0.8, strokeWidth / zoom);
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

      // ONLY IN EDIT_VERTICES MODE: Show discrete, well-spaced control handles
      if (mode === 'EDIT_VERTICES' && !isConfirmed) {
        const dotRadius = Math.max(2.5, Math.min(4.5, 3.5 / zoom));
        for (let i = 0; i < pts.length; i++) {
          const v = pts[i];
          const isHovered = hoveredVertexIndex === i;
          const isSelected = selectedVertexIndex === i;

          // Outer halo
          if (isHovered || isSelected) {
            ctx.beginPath();
            ctx.arc(v.x, v.y, dotRadius * 1.8, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.45)' : 'rgba(245, 158, 11, 0.35)';
            ctx.fill();
          }

          // Compact handle body
          ctx.beginPath();
          ctx.arc(v.x, v.y, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? '#38bdf8' : '#f59e0b';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(0.8, 1.0 / zoom);
          ctx.stroke();
        }
      }
    }

    // LAYER 5: LIVE FREEHAND / RESHAPE / ADD DRAWING PATH (Clean, Crisp Solid Pencil Trace)
    const fhPts = freehandPointsRef.current;
    if ((isDrawingFreehandRef.current || (isBrushingRef.current && mode === 'ADD')) && fhPts.length > 1) {
      ctx.save();
      ctx.strokeStyle = mode === 'RESHAPE' ? '#2dd4bf' : mode === 'ADD' ? '#22c55e' : '#38bdf8';
      ctx.lineWidth = mode === 'ADD' ? Math.max(1.0, brushSize / zoom) : Math.max(0.8, strokeWidth / zoom);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(fhPts[0].x, fhPts[0].y);
      for (let i = 1; i < fhPts.length; i++) {
        ctx.lineTo(fhPts[i].x, fhPts[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // LAYER 6: LIVE CIRCLE / ELLIPSE PREVIEW (Smooth Continuous Ellipse Outline)
    if (mode === 'CIRCLE' && circleStartImgRef.current && circleCurrentImgRef.current) {
      const p1 = circleStartImgRef.current;
      const p2 = circleCurrentImgRef.current;
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rx = Math.abs(p2.x - p1.x) / 2;
      const ry = Math.abs(p2.y - p1.y) / 2;

      ctx.save();
      // Pass 1: Dark underlay
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = Math.max(1.2, (strokeWidth + 0.8) / zoom);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
      ctx.stroke();

      // Pass 2: Smooth foreground
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = Math.max(0.8, strokeWidth / zoom);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // LAYER 7: CURSOR FOOTPRINT (ADD/ERASE Brush Ring & RESHAPE Sculpt Hand Ring)
    const mPos = mousePosRef.current;
    if (mPos && !isSpacePressed) {
      if (mode === 'ADD' || mode === 'ERASE') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(mPos.x, mPos.y, (brushSize * zoom) / 2, 0, Math.PI * 2);
        ctx.strokeStyle = mode === 'ADD' ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.fillStyle = mode === 'ADD' ? 'rgba(34, 197, 94, 0.22)' : 'rgba(239, 68, 68, 0.22)';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (mode === 'RESHAPE') {
        ctx.save();
        // Pass 1: Dark underlay shadow
        ctx.beginPath();
        ctx.arc(mPos.x, mPos.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 3.0;
        ctx.stroke();

        // Pass 2: Clean High-Contrast White Sculpt Ring
        ctx.beginPath();
        ctx.arc(mPos.x, mPos.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fill();
        ctx.stroke();

        // Inner White Core Dot
        ctx.beginPath();
        ctx.arc(mPos.x, mPos.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
      }
    }
  }, [
    imageWidth,
    imageHeight,
    showOriginal,
    isConfirmed,
    confirmedBoundaryColor,
    mode,
    brushSize,
    strokeWidth,
    lineStyle,
    maskOpacity,
    hoveredVertexIndex,
    hoveredEdgeIndex,
    hoveredRegionId,
    selectedVertexIndex,
    regions,
    activeRegionId,
    isSpacePressed,
    sharpMode,
  ]);

  // 1. Load Slide Image
  const loadedImageUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!imageUrl) return;
    if (loadedImageUrlRef.current === imageUrl && imgElementRef.current) {
      return; // Already loaded, maintain user's current zoom and pan!
    }
    let isMounted = true;
    loadImageAsync(imageUrl)
      .then((img) => {
        if (isMounted) {
          const isBrandNewImage = loadedImageUrlRef.current !== imageUrl;
          imgElementRef.current = img;
          loadedImageUrlRef.current = imageUrl;
          if (isBrandNewImage) {
            fitToScreen();
          } else {
            renderCanvas();
          }
        }
      })
      .catch((err) => console.error('Failed loading histopathology image:', err));
    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  // 2. Load Mask onto Canvas
  useEffect(() => {
    const maskSrc = vectorSelection ? rasterizePolygonToBinaryMask(vectorSelection.points, imageWidth, imageHeight) : null;
    if (!maskSrc) {
      const ctx = maskCanvasRef.current.getContext('2d');
      if (ctx && imageWidth > 0 && imageHeight > 0) {
        maskCanvasRef.current.width = imageWidth;
        maskCanvasRef.current.height = imageHeight;
        ctx.clearRect(0, 0, imageWidth, imageHeight);
      }
      activeMaskVersionRef.current = null;
      renderCanvas();
      return;
    }

    if (maskSrc !== activeMaskVersionRef.current) {
      activeMaskVersionRef.current = maskSrc;
      loadMaskOntoCanvas(maskCanvasRef.current, maskSrc, imageWidth, imageHeight)
        .then(() => renderCanvas())
        .catch((err) => console.error('Failed loading mask onto canvas:', err));
    }
  }, [vectorSelection, imageWidth, imageHeight, renderCanvas]);

  // 3. Smooth Camera Animation
  const animateCameraTo = useCallback((targetZoom: number, targetPan: Point2D, durationMs: number = 180) => {
    const startZoom = cameraRef.current.zoom;
    const startPan = { ...cameraRef.current.pan };
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const ease = 1 - Math.pow(1 - progress, 3);

      const curZoom = startZoom + (targetZoom - startZoom) * ease;
      const curPanX = startPan.x + (targetPan.x - startPan.x) * ease;
      const curPanY = startPan.y + (targetPan.y - startPan.y) * ease;

      cameraRef.current.zoom = Number(curZoom.toFixed(4));
      cameraRef.current.pan = { x: Math.round(curPanX), y: Math.round(curPanY) };
      setDisplayZoom(cameraRef.current.zoom);
      renderCanvas();

      if (progress < 1.0) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [renderCanvas]);

  // 4. Fit Slide to Screen
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !imageWidth || !imageHeight) return;
    const cw = containerRef.current.clientWidth - 40;
    const ch = containerRef.current.clientHeight - 40;
    if (cw <= 0 || ch <= 0) return;

    const scale = Math.min(cw / imageWidth, ch / imageHeight, 1.0);
    const newZoom = Math.max(0.05, Number(scale.toFixed(4)));
    const displayW = imageWidth * newZoom;
    const displayH = imageHeight * newZoom;

    cameraRef.current.zoom = newZoom;
    cameraRef.current.pan = {
      x: Math.round((containerRef.current.clientWidth - displayW) / 2),
      y: Math.round((containerRef.current.clientHeight - displayH) / 2),
    };

    setDisplayZoom(newZoom);
    renderCanvas();
  }, [imageWidth, imageHeight, renderCanvas]);

  // 5. Focus Active Region Camera (Preserves user's manual pan/zoom if no region exists)
  const handleFocusActiveRegion = useCallback((targetBBox?: [number, number, number, number] | null) => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;

    const b = targetBBox || vectorSelection?.bbox;
    if (!b || (b[2] <= b[0] && b[3] <= b[1])) {
      return;
    }

    const { zoom: targetZoom, pan: targetPan } = calculateFitTransform(b, cw, ch, 0.32, 0.5, 10.0);
    animateCameraTo(targetZoom, targetPan, 200);
  }, [vectorSelection, animateCameraTo]);

  // 6. Show All Regions
  const handleShowAllRegions = useCallback(() => {
    if (!containerRef.current || regions.length === 0) {
      fitToScreen();
      return;
    }
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;

    const allBBoxes = regions
      .map((r) => r.vectorSelection?.bbox)
      .filter((b): b is [number, number, number, number] => !!b);

    const combined = computeCombinedBBox(allBBoxes);
    if (!combined) {
      fitToScreen();
      return;
    }

    const { zoom: targetZoom, pan: targetPan } = calculateFitTransform(combined, cw, ch, 0.25, 0.2, 8.0);
    animateCameraTo(targetZoom, targetPan, 220);
  }, [regions, fitToScreen, animateCameraTo]);

  // Triggers (Only fire when user explicitly clicks Focus or Show All buttons!)
  const prevFocusTriggerRef = useRef(focusTrigger);
  useEffect(() => {
    if (focusTrigger > 0 && focusTrigger !== prevFocusTriggerRef.current) {
      prevFocusTriggerRef.current = focusTrigger;
      handleFocusActiveRegion();
    }
  }, [focusTrigger, handleFocusActiveRegion]);

  const prevShowAllTriggerRef = useRef(showAllTrigger);
  useEffect(() => {
    if (showAllTrigger > 0 && showAllTrigger !== prevShowAllTriggerRef.current) {
      prevShowAllTriggerRef.current = showAllTrigger;
      handleShowAllRegions();
    }
  }, [showAllTrigger, handleShowAllRegions]);

  const resetView = () => {
    if (!containerRef.current) return;
    cameraRef.current.zoom = 1.0;
    cameraRef.current.pan = {
      x: Math.round((containerRef.current.clientWidth - imageWidth) / 2),
      y: Math.round((containerRef.current.clientHeight - imageHeight) / 2),
    };
    setDisplayZoom(1.0);
    renderCanvas();
  };

  const handleZoomDelta = (factor: number) => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const cx = cw / 2;
    const cy = ch / 2;

    const curZoom = cameraRef.current.zoom;
    const curPan = cameraRef.current.pan;
    const nextZoom = Math.max(0.05, Math.min(25.0, Number((curZoom * factor).toFixed(4))));

    const nextPanX = cx - (cx - curPan.x) * (nextZoom / curZoom);
    const nextPanY = cy - (cy - curPan.y) * (nextZoom / curZoom);

    cameraRef.current.zoom = nextZoom;
    cameraRef.current.pan = { x: Math.round(nextPanX), y: Math.round(nextPanY) };
    setDisplayZoom(nextZoom);
    renderCanvas();
  };

  // 7. MOUSE-CENTERED WHEEL ZOOM & SHIFT+WHEEL BRUSH RESIZING
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // If Shift is pressed, dynamically adjust brush/eraser size right under cursor!
      if (e.shiftKey && setBrushSize) {
        const delta = e.deltaY < 0 ? 5 : -5;
        const newSize = Math.max(2, Math.min(150, brushSize + delta));
        setBrushSize(newSize);
        return;
      }

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const curZoom = cameraRef.current.zoom;
      const curPan = cameraRef.current.pan;

      // Normalize delta across browsers/devices
      let rawDelta = e.deltaY;
      if (e.deltaMode === 1) rawDelta *= 16;
      else if (e.deltaMode === 2) rawDelta *= 800;

      // Proportional exponential zooming: continuous & smooth for touchpad gestures and mouse scroll wheels
      const sensitivity = e.ctrlKey ? 0.005 : 0.0012;
      let zoomFactor = Math.exp(-rawDelta * sensitivity);

      // Clamp max single-event zoom ratio to prevent abrupt jumps on high-velocity touchpads
      zoomFactor = Math.max(0.80, Math.min(1.25, zoomFactor));

      const nextZoom = Math.max(0.05, Math.min(25.0, Number((curZoom * zoomFactor).toFixed(4))));

      const nextPanX = mouseX - (mouseX - curPan.x) * (nextZoom / curZoom);
      const nextPanY = mouseY - (mouseY - curPan.y) * (nextZoom / curZoom);

      cameraRef.current.zoom = nextZoom;
      cameraRef.current.pan = { x: Math.round(nextPanX), y: Math.round(nextPanY) };

      setDisplayZoom(nextZoom);
      renderCanvas();
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, [renderCanvas, brushSize, setBrushSize]);

  // 8. GLOBAL KEYBOARD SHORTCUTS (+ / - ZOOM, [ / ] BRUSH SIZE)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        handleZoomDelta(1.2);
      } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        handleZoomDelta(1 / 1.2);
      } else if (e.key === '[' && setBrushSize) {
        e.preventDefault();
        setBrushSize(Math.max(1, brushSize <= 5 ? brushSize - 1 : brushSize <= 20 ? brushSize - 2 : brushSize - 5));
      } else if (e.key === ']' && setBrushSize) {
        e.preventDefault();
        setBrushSize(Math.min(150, brushSize < 5 ? brushSize + 1 : brushSize < 20 ? brushSize + 2 : brushSize + 5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleZoomDelta, brushSize, setBrushSize]);

  // SMOOTH / RELAX CONTOUR ACTION
  const handleSmoothContour = useCallback(() => {
    const currentPts = activeVectorPointsRef.current;
    if (!currentPts || currentPts.length < 4) return;

    const smoothedPts = smoothPolygon(currentPts, 2, 0.25);
    activeVectorPointsRef.current = smoothedPts;
    const newBBox = computePolygonBBox(smoothedPts);
    const newArea = calculatePolygonAreaPixels(smoothedPts, imageWidth, imageHeight);
    const updatedSel: VectorSelection = {
      ...(vectorSelection || {
        id: `sel_${Date.now()}`,
        isClosed: true,
        isConfirmed: false,
        mode: 'exact',
      }),
      points: smoothedPts,
      bbox: newBBox,
      areaPixels: newArea,
    };
    const rasterMask = rasterizePolygonToBinaryMask(smoothedPts, imageWidth, imageHeight);
    onVectorSelectionChange?.(updatedSel, rasterMask);
    renderCanvas();
  }, [imageWidth, imageHeight, vectorSelection, onVectorSelectionChange, renderCanvas]);

  // 1-Click Trim Spikes & Sharp Needle Protrusions Helper
  const handleTrimSpikes = useCallback(() => {
    const currentPts = activeVectorPointsRef.current;
    if (!currentPts || currentPts.length < 4) return;

    const trimmedPts = trimPolygonSpikesAndLoops(currentPts, 40);
    if (!trimmedPts || trimmedPts.length < 3) return;

    activeVectorPointsRef.current = trimmedPts;
    const newBBox = computePolygonBBox(trimmedPts);
    const newArea = calculatePolygonAreaPixels(trimmedPts, imageWidth, imageHeight);
    const updatedSel: VectorSelection = {
      ...(vectorSelection || {
        id: `sel_${Date.now()}`,
        isClosed: true,
        isConfirmed: false,
        mode: 'exact',
      }),
      points: trimmedPts,
      bbox: newBBox,
      areaPixels: newArea,
    };
    const rasterMask = rasterizePolygonToBinaryMask(trimmedPts, imageWidth, imageHeight);
    onVectorSelectionChange?.(updatedSel, rasterMask);
    renderCanvas();
  }, [imageWidth, imageHeight, vectorSelection, onVectorSelectionChange, renderCanvas]);

  // Delete Selected Vertex Helper
  const handleDeleteSelectedVertex = useCallback(() => {
    const currentPts = activeVectorPointsRef.current;
    if (selectedVertexIndex === null || !currentPts || currentPts.length <= 3) return;

    const updatedPts = deleteVertex(currentPts, selectedVertexIndex);
    activeVectorPointsRef.current = updatedPts;
    const newBBox = computePolygonBBox(updatedPts);
    const newArea = calculatePolygonAreaPixels(updatedPts, imageWidth, imageHeight);
    const updatedSel: VectorSelection = {
      ...(vectorSelection || {
        id: `sel_${Date.now()}`,
        isClosed: true,
        isConfirmed: false,
        mode: 'exact',
      }),
      points: updatedPts,
      bbox: newBBox,
      areaPixels: newArea,
    };
    const rasterMask = rasterizePolygonToBinaryMask(updatedPts, imageWidth, imageHeight);
    onVectorSelectionChange?.(updatedSel, rasterMask);
    setSelectedVertexIndex(null);
    renderCanvas();
  }, [selectedVertexIndex, imageWidth, imageHeight, vectorSelection, onVectorSelectionChange, setSelectedVertexIndex, renderCanvas]);

  // Explicit Manual Add Point Helper
  const handleInsertVertexExplicit = useCallback(() => {
    const currentPts = activeVectorPointsRef.current;
    if (!currentPts || currentPts.length < 3) return;

    let targetEdge = 1;
    if (selectedVertexIndex !== null && selectedVertexIndex >= 0 && selectedVertexIndex < currentPts.length) {
      targetEdge = selectedVertexIndex + 1;
    } else {
      let maxLen = -1;
      for (let i = 0; i < currentPts.length; i++) {
        const nextIdx = (i + 1) % currentPts.length;
        const d = distance(currentPts[i], currentPts[nextIdx]);
        if (d > maxLen) {
          maxLen = d;
          targetEdge = i + 1;
        }
      }
    }

    const p1 = currentPts[targetEdge - 1];
    const p2 = currentPts[targetEdge % currentPts.length];
    const midPoint: Point2D = {
      x: Math.round((p1.x + p2.x) / 2),
      y: Math.round((p1.y + p2.y) / 2),
    };

    const updatedPts = insertVertex(currentPts, midPoint, targetEdge);
    activeVectorPointsRef.current = updatedPts;
    const newBBox = computePolygonBBox(updatedPts);
    const newArea = calculatePolygonAreaPixels(updatedPts, imageWidth, imageHeight);
    const updatedSel: VectorSelection = {
      ...(vectorSelection || {
        id: `sel_${Date.now()}`,
        isClosed: true,
        isConfirmed: false,
        mode: 'exact',
      }),
      points: updatedPts,
      bbox: newBBox,
      areaPixels: newArea,
    };
    const rasterMask = rasterizePolygonToBinaryMask(updatedPts, imageWidth, imageHeight);
    onVectorSelectionChange?.(updatedSel, rasterMask);
    setSelectedVertexIndex(targetEdge);
    renderCanvas();
  }, [selectedVertexIndex, imageWidth, imageHeight, vectorSelection, onVectorSelectionChange, setSelectedVertexIndex, renderCanvas]);

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    addPointAtSelection: handleInsertVertexExplicit,
    deleteSelectedPoint: handleDeleteSelectedVertex,
    smoothCurrentContour: handleSmoothContour,
    trimSpikes: handleTrimSpikes,
  }), [handleInsertVertexExplicit, handleDeleteSelectedVertex, handleSmoothContour, handleTrimSpikes]);

  // Keyboard Shortcuts (Spacebar to Pan, Delete/Backspace in EDIT_VERTICES)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && mode === 'EDIT_VERTICES' && selectedVertexIndex !== null) {
        handleDeleteSelectedVertex();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    const handleGlobalPointerUp = () => {
      if (activeInteractionRef.current.type !== 'none' || isDrawingFreehandRef.current || isPanningRef.current) {
        activeInteractionRef.current = { type: 'none' };
        dragStartImgRef.current = null;
        initialPointsAtDragRef.current = null;
        isDrawingFreehandRef.current = false;
        isPanningRef.current = false;
        renderCanvas();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  });

  // 8. POINTER EVENT HANDLERS
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const { zoom, pan } = cameraRef.current;

    pointerDownScreenPosRef.current = screenPt;
    hasDraggedSignificantDistanceRef.current = false;

    // Check PAN Triggers
    if (mode === 'PAN' || e.button === 1 || isSpacePressed || e.altKey) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const imgCoord = screenToImage(
      e.clientX,
      e.clientY,
      rect,
      pan.x,
      pan.y,
      zoom,
      imageWidth,
      imageHeight,
      imageWidth,
      imageHeight
    );

    // 1. MODE: FREE_SELECT (Freehand Drag Drawing)
    if (mode === 'FREE_SELECT') {
      pointerDownScreenPosRef.current = screenPt;
      hasDraggedSignificantDistanceRef.current = false;
      isDrawingFreehandRef.current = true;
      freehandPointsRef.current = [imgCoord];
      e.currentTarget.setPointerCapture(e.pointerId);
      renderCanvas();
      return;
    }

    // 2. MODE: CIRCLE / ELLIPSE (Drag to create circular/oval nucleus ROI)
    if (mode === 'CIRCLE') {
      pointerDownScreenPosRef.current = screenPt;
      hasDraggedSignificantDistanceRef.current = false;
      circleStartImgRef.current = imgCoord;
      circleCurrentImgRef.current = imgCoord;
      e.currentTarget.setPointerCapture(e.pointerId);
      renderCanvas();
      return;
    }

    // 3. MODE: RESHAPE / SCULPT (Direct Elastic Clay Boundary Sculpting)
    if (mode === 'RESHAPE') {
      const currentPts = activeVectorPointsRef.current;
      if (currentPts && currentPts.length >= 3) {
        // Adaptive hit distance: 60 screen pixels for easy boundary grabbing
        const edgeHitDistImg = Math.max(5, 60 / zoom);
        const edgeHit = findClosestEdge(imgCoord, currentPts, edgeHitDistImg);
        const targetGrabPoint = edgeHit ? edgeHit.insertPoint : imgCoord;

        e.currentTarget.setPointerCapture(e.pointerId);
        activeInteractionRef.current = {
          type: 'elastic_sculpt',
          grabPoint: targetGrabPoint,
        };
        dragStartImgRef.current = imgCoord;
        initialPointsAtDragRef.current = [...currentPts];
        renderCanvas();
        return;
      }
    }

    // 4. MODE: EDIT VERTICES (Interactive Control Points)
    if (mode === 'EDIT_VERTICES') {
      const currentPts = activeVectorPointsRef.current;
      if (currentPts && currentPts.length >= 3) {
        // Priority 1: Select & Drag an existing vertex
        const hitVertexIdx = findClosestVertex(screenPt, currentPts, zoom, pan, 16);
        if (hitVertexIdx !== null) {
          e.currentTarget.setPointerCapture(e.pointerId);
          activeInteractionRef.current = { type: 'vertex', vertexIndex: hitVertexIdx };
          setSelectedVertexIndex(hitVertexIdx);
          dragStartImgRef.current = imgCoord;
          initialPointsAtDragRef.current = [...currentPts];
          renderCanvas();
          return;
        }

        // Priority 2: Click/Drag inside polygon body to translate
        if (isPointInPolygon(imgCoord, currentPts)) {
          e.currentTarget.setPointerCapture(e.pointerId);
          activeInteractionRef.current = { type: 'move' };
          dragStartImgRef.current = imgCoord;
          initialPointsAtDragRef.current = [...currentPts];
          renderCanvas();
          return;
        }
      }
      return;
    }

    // 5. MODE: ADD / ERASE Brush
    if (mode === 'ADD' || mode === 'ERASE') {
      isBrushingRef.current = true;
      lastBrushPointRef.current = imgCoord;
      if (mode === 'ADD') {
        isDrawingFreehandRef.current = true;
        freehandPointsRef.current = [imgCoord];
      } else if (mode === 'ERASE' && activeVectorPointsRef.current && activeVectorPointsRef.current.length >= 3) {
        const eraseRadiusImg = Math.max(8, (brushSize * 1.5) / cameraRef.current.zoom);
        const erased = subtractCircleFromPolygon(activeVectorPointsRef.current, imgCoord, eraseRadiusImg);
        if (erased) {
          activeVectorPointsRef.current = erased.length >= 3 ? erased : null;
        }
      }
      applyBrushSegmentToMaskCanvas(maskCanvasRef.current, imgCoord, imgCoord, mode, brushSize);
      e.currentTarget.setPointerCapture(e.pointerId);
      renderCanvas();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    mousePosRef.current = screenPt;

    // Handle Active Pan
    if (isPanningRef.current) {
      const nextPanX = Math.round(e.clientX - panStartRef.current.x);
      const nextPanY = Math.round(e.clientY - panStartRef.current.y);
      cameraRef.current.pan = { x: nextPanX, y: nextPanY };
      renderCanvas();
      return;
    }

    const { zoom, pan } = cameraRef.current;
    const imgCoord = screenToImage(
      e.clientX,
      e.clientY,
      rect,
      pan.x,
      pan.y,
      zoom,
      imageWidth,
      imageHeight,
      imageWidth,
      imageHeight
    );
    mouseImgPosRef.current = imgCoord;

    // Track drag distance from pointer down
    if (pointerDownScreenPosRef.current) {
      const d = Math.hypot(
        screenPt.x - pointerDownScreenPosRef.current.x,
        screenPt.y - pointerDownScreenPosRef.current.y
      );
      if (d > 5) {
        hasDraggedSignificantDistanceRef.current = true;
      }
    }

    // Hover detection over non-active regions when idle (disabled in PAN mode)
    if (mode !== 'PAN' && !isDrawingFreehandRef.current && !isPanningRef.current && !isBrushingRef.current && !circleStartImgRef.current) {
      let hitRegId: string | null = null;
      if (regions && regions.length > 0) {
        for (const reg of regions) {
          if (reg.id !== activeRegionId && reg.vectorSelection?.points && reg.vectorSelection.points.length >= 3) {
            if (isPointInPolygon(imgCoord, reg.vectorSelection.points)) {
              hitRegId = reg.id;
              break;
            }
            const edgeHit = findClosestEdge(imgCoord, reg.vectorSelection.points, Math.max(3, 15 / zoom));
            if (edgeHit) {
              hitRegId = reg.id;
              break;
            }
          }
        }
      }
      if (hitRegId !== hoveredRegionId) {
        setHoveredRegionId(hitRegId);
      }
    }

    // 1. In FREE_SELECT Mode (Continuous freehand drawing)
    if (mode === 'FREE_SELECT') {
      if (isDrawingFreehandRef.current) {
        const fh = freehandPointsRef.current;
        const lastPt = fh[fh.length - 1];
        if (!lastPt || distance(lastPt, imgCoord) >= 2) {
          fh.push(imgCoord);
          renderCanvas();
        }
      } else {
        setCursorStyle(hoveredRegionId ? 'pointer' : 'crosshair');
      }
      return;
    }

    // 2. In CIRCLE Mode
    if (mode === 'CIRCLE') {
      if (circleStartImgRef.current) {
        circleCurrentImgRef.current = imgCoord;
        renderCanvas();
      } else {
        setCursorStyle('crosshair');
      }
      return;
    }

    // 3. In RESHAPE Mode
    if (mode === 'RESHAPE') {
      // Safety release: if mouse button is not pressed down, cancel any active sculpting immediately
      if (e.buttons === 0) {
        if (activeInteractionRef.current.type !== 'none' || isDrawingFreehandRef.current) {
          activeInteractionRef.current = { type: 'none' };
          dragStartImgRef.current = null;
          initialPointsAtDragRef.current = null;
          isDrawingFreehandRef.current = false;
          freehandPointsRef.current = [];
          renderCanvas();
        }
      }

      const interaction = activeInteractionRef.current;

      // Performing Elastic Sculpt (Push / Pull)
      if (interaction.type === 'elastic_sculpt' && initialPointsAtDragRef.current && dragStartImgRef.current && interaction.grabPoint) {
        const delta = {
          x: imgCoord.x - dragStartImgRef.current.x,
          y: imgCoord.y - dragStartImgRef.current.y,
        };
        const influenceRadiusImg = Math.max(3, 45 / zoom);
        activeVectorPointsRef.current = elasticDeformPolygon(initialPointsAtDragRef.current, interaction.grabPoint, delta, influenceRadiusImg);
        renderCanvas();
        return;
      }

      // Performing Draw-To-Reshape stroke
      if (interaction.type === 'stroke_reshape' && isDrawingFreehandRef.current) {
        const fh = freehandPointsRef.current;
        const lastPt = fh[fh.length - 1];
        if (!lastPt || distance(lastPt, imgCoord) >= 2) {
          fh.push(imgCoord);
          renderCanvas();
        }
        return;
      }

      // Hover feedback for Reshape (Real-time 60fps hand cursor tracking)
      const currentPts = activeVectorPointsRef.current;
      if (currentPts && currentPts.length >= 3) {
        const edgeHitDistImg = Math.max(5, 60 / zoom);
        const edgeHit = findClosestEdge(imgCoord, currentPts, edgeHitDistImg);
        setCursorStyle(edgeHit !== null ? 'grab' : 'crosshair');
      }
      renderCanvas();
      return;
    }

    // 4. In EDIT_VERTICES Mode (Interacting with boundary points)
    if (mode === 'EDIT_VERTICES') {
      const interaction = activeInteractionRef.current;

      // Moving a single vertex
      if (interaction.type === 'vertex' && interaction.vertexIndex !== undefined && activeVectorPointsRef.current) {
        activeVectorPointsRef.current[interaction.vertexIndex] = imgCoord;
        renderCanvas();
        return;
      }

      // Translating entire shape
      if (interaction.type === 'move' && initialPointsAtDragRef.current && dragStartImgRef.current) {
        const dx = imgCoord.x - dragStartImgRef.current.x;
        const dy = imgCoord.y - dragStartImgRef.current.y;
        activeVectorPointsRef.current = translatePolygon(initialPointsAtDragRef.current, dx, dy);
        renderCanvas();
        return;
      }

      // Hover Hit-Testing for vertices
      const currentPts = activeVectorPointsRef.current;
      if (currentPts && currentPts.length >= 3) {
        const hitIdx = findClosestVertex(screenPt, currentPts, zoom, pan, 16);
        if (hitIdx !== hoveredVertexIndex) {
          setHoveredVertexIndex(hitIdx);
        }

        setCursorStyle(
          hitIdx !== null ? 'grab' : isPointInPolygon(imgCoord, currentPts) ? 'move' : 'crosshair'
        );
        renderCanvas();
      }
      return;
    }

    // 5. ADD / ERASE Continuous Brush & Real-Time Cursor Tracking
    if (mode === 'ADD' || mode === 'ERASE') {
      if (isBrushingRef.current && lastBrushPointRef.current) {
        applyBrushSegmentToMaskCanvas(maskCanvasRef.current, lastBrushPointRef.current, imgCoord, mode, brushSize);
        lastBrushPointRef.current = imgCoord;

        if (mode === 'ERASE' && activeVectorPointsRef.current && activeVectorPointsRef.current.length >= 3) {
          const eraseRadiusImg = Math.max(8, (brushSize * 1.5) / cameraRef.current.zoom);
          const erased = subtractCircleFromPolygon(activeVectorPointsRef.current, imgCoord, eraseRadiusImg);
          if (erased) {
            activeVectorPointsRef.current = erased.length >= 3 ? erased : null;
          }
        }

        if (mode === 'ADD') {
          const fh = freehandPointsRef.current;
          const lastPt = fh[fh.length - 1];
          if (!lastPt || distance(lastPt, imgCoord) >= 2) {
            fh.push(imgCoord);
          }
        }
      }

      // Re-render canvas on every hover/drag move frame so Eraser / ADD cursor ring tracks pointer at 60-120 fps!
      renderCanvas();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
    }

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    // In PAN mode, releasing pointer simply finishes panning. Never select regions or alter camera!
    if (mode === 'PAN') {
      pointerDownScreenPosRef.current = null;
      hasDraggedSignificantDistanceRef.current = false;
      return;
    }

    // Check if user did a simple click without dragging (movement <= 5px)
    const wasSimpleClick = !hasDraggedSignificantDistanceRef.current;
    pointerDownScreenPosRef.current = null;
    hasDraggedSignificantDistanceRef.current = false;

    // Simple Click: Check if user clicked on any existing region to activate it (ONLY in FREE_SELECT or CIRCLE)
    if (wasSimpleClick && (mode === 'FREE_SELECT' || mode === 'CIRCLE')) {
      if (isDrawingFreehandRef.current) {
        isDrawingFreehandRef.current = false;
        freehandPointsRef.current = [];
      }
      if (circleStartImgRef.current) {
        circleStartImgRef.current = null;
        circleCurrentImgRef.current = null;
      }

      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const { zoom, pan } = cameraRef.current;
        const imgCoord = screenToImage(
          e.clientX,
          e.clientY,
          rect,
          pan.x,
          pan.y,
          zoom,
          imageWidth,
          imageHeight,
          imageWidth,
          imageHeight
        );

        if (regions && regions.length > 0) {
          for (const reg of regions) {
            if (reg.vectorSelection?.points && reg.vectorSelection.points.length >= 3) {
              if (isPointInPolygon(imgCoord, reg.vectorSelection.points)) {
                onSelectRegion?.(reg.id);
                renderCanvas();
                return;
              }
              const edgeHit = findClosestEdge(imgCoord, reg.vectorSelection.points, Math.max(3, 15 / zoom));
              if (edgeHit) {
                onSelectRegion?.(reg.id);
                renderCanvas();
                return;
              }
            }
          }
        }
      }
    }

    // 1. Complete Freehand Selection Drawing (Keeps exact user-drawn path 1:1)
    if (mode === 'FREE_SELECT' && isDrawingFreehandRef.current) {
      isDrawingFreehandRef.current = false;
      const fh = freehandPointsRef.current;
      freehandPointsRef.current = [];

      if (fh.length > 3) {
        // Keep 100% exact user drawn points & auto-untangle self-crossing loops!
        const exactPts = removeSelfIntersectionsAndLoops([...fh]);
        const selBBox = computePolygonBBox(exactPts);
        const selArea = calculatePolygonAreaPixels(exactPts, imageWidth, imageHeight);
        const newVectorSel: VectorSelection = {
          id: `sel_${Date.now()}`,
          points: exactPts,
          initialPoints: exactPts.map((p) => ({ ...p })),
          bbox: selBBox,
          areaPixels: selArea,
          isClosed: true,
          isConfirmed: false,
          mode: 'exact',
        };
        const rasterMask = rasterizePolygonToBinaryMask(exactPts, imageWidth, imageHeight);

        // A new region is ONLY created if the existing selection has been CONFIRMED!
        const shouldCreateNewRegion = !!(
          isConfirmed &&
          vectorSelection &&
          vectorSelection.points &&
          vectorSelection.points.length >= 3
        );

        if (shouldCreateNewRegion && onAddNewRegionWithSelection) {
          onAddNewRegionWithSelection(newVectorSel, rasterMask);
        } else {
          activeVectorPointsRef.current = exactPts;
          onVectorSelectionChange?.(newVectorSel, rasterMask);
        }
      }
      renderCanvas();
      return;
    }

    // 2. Complete Circle / Ellipse Creation (Smooth 64-point circle)
    if (mode === 'CIRCLE' && circleStartImgRef.current && circleCurrentImgRef.current) {
      const p1 = circleStartImgRef.current;
      const p2 = circleCurrentImgRef.current;
      circleStartImgRef.current = null;
      circleCurrentImgRef.current = null;

      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rx = Math.abs(p2.x - p1.x) / 2;
      const ry = Math.abs(p2.y - p1.y) / 2;

      if (rx > 3 && ry > 3) {
        const ellipsePts = createEllipsePoints(cx, cy, rx, ry, 64);
        const selBBox = computePolygonBBox(ellipsePts);
        const selArea = calculatePolygonAreaPixels(ellipsePts, imageWidth, imageHeight);
        const newVectorSel: VectorSelection = {
          id: `sel_${Date.now()}`,
          points: ellipsePts,
          initialPoints: ellipsePts.map((p) => ({ ...p })),
          bbox: selBBox,
          areaPixels: selArea,
          isClosed: true,
          isConfirmed: false,
          mode: 'exact',
        };
        const rasterMask = rasterizePolygonToBinaryMask(ellipsePts, imageWidth, imageHeight);

        // A new region is ONLY created if the existing selection has been CONFIRMED!
        const shouldCreateNewRegion = !!(
          isConfirmed &&
          vectorSelection &&
          vectorSelection.points &&
          vectorSelection.points.length >= 3
        );

        if (shouldCreateNewRegion && onAddNewRegionWithSelection) {
          onAddNewRegionWithSelection(newVectorSel, rasterMask);
        } else {
          activeVectorPointsRef.current = ellipsePts;
          onVectorSelectionChange?.(newVectorSel, rasterMask);
        }
      }
      renderCanvas();
      return;
    }

    // 3. Complete Reshape / Sculpt
    if (mode === 'RESHAPE') {
      const interaction = activeInteractionRef.current;

      // Complete Elastic Sculpt (Preserves exact deformed shape)
      if (interaction.type === 'elastic_sculpt' && activeVectorPointsRef.current) {
        const finalPts = [...activeVectorPointsRef.current];
        const selBBox = computePolygonBBox(finalPts);
        const selArea = calculatePolygonAreaPixels(finalPts, imageWidth, imageHeight);
        const updatedSel: VectorSelection = {
          ...(vectorSelection || {
            id: `sel_${Date.now()}`,
            isClosed: true,
            isConfirmed: false,
            mode: 'exact',
          }),
          points: finalPts,
          bbox: selBBox,
          areaPixels: selArea,
        };
        const rasterMask = rasterizePolygonToBinaryMask(finalPts, imageWidth, imageHeight);
        onVectorSelectionChange?.(updatedSel, rasterMask);
      }

      // Complete Draw-To-Reshape Stroke
      if (interaction.type === 'stroke_reshape') {
        isDrawingFreehandRef.current = false;
        const fh = freehandPointsRef.current;
        const existingPts = activeVectorPointsRef.current;

        if (fh.length > 2 && existingPts && existingPts.length >= 3) {
          const maxSnapImg = Math.max(10, 50 / cameraRef.current.zoom);
          const reshaped = spliceReshapeStroke(existingPts, fh, maxSnapImg);
          if (reshaped && reshaped.length >= 3) {
            const finalPts = [...reshaped];
            activeVectorPointsRef.current = finalPts;
            const selBBox = computePolygonBBox(finalPts);
            const selArea = calculatePolygonAreaPixels(finalPts, imageWidth, imageHeight);
            const updatedSel: VectorSelection = {
              ...(vectorSelection || {
                id: `sel_${Date.now()}`,
                isClosed: true,
                isConfirmed: false,
                mode: 'exact',
              }),
              points: finalPts,
              bbox: selBBox,
              areaPixels: selArea,
            };
            const rasterMask = rasterizePolygonToBinaryMask(finalPts, imageWidth, imageHeight);
            onVectorSelectionChange?.(updatedSel, rasterMask);
          }
        }
        freehandPointsRef.current = [];
      }

      activeInteractionRef.current = { type: 'none' };
      dragStartImgRef.current = null;
      initialPointsAtDragRef.current = null;
      isDrawingFreehandRef.current = false;
      renderCanvas();
      return;
    }

    // 4. Commit Vertex Drag or Move in EDIT_VERTICES
    const interaction = activeInteractionRef.current;
    if (mode === 'EDIT_VERTICES' && (interaction.type === 'vertex' || interaction.type === 'move') && activeVectorPointsRef.current && onVectorSelectionChange) {
      const finalPts = [...activeVectorPointsRef.current];
      const newBBox = computePolygonBBox(finalPts);
      const newArea = calculatePolygonAreaPixels(finalPts, imageWidth, imageHeight);
      const updatedSel: VectorSelection = {
        ...(vectorSelection || {
          id: `sel_${Date.now()}`,
          isClosed: true,
          isConfirmed: false,
          mode: 'exact',
        }),
        points: finalPts,
        bbox: newBBox,
        areaPixels: newArea,
      };
      const rasterMask = rasterizePolygonToBinaryMask(finalPts, imageWidth, imageHeight);
      onVectorSelectionChange(updatedSel, rasterMask);
    }

    activeInteractionRef.current = { type: 'none' };
    dragStartImgRef.current = null;
    initialPointsAtDragRef.current = null;

    // 5. Complete Brush Drag (ADD / ERASE)
    if (isBrushingRef.current) {
      isBrushingRef.current = false;
      lastBrushPointRef.current = null;

      if (mode === 'ADD' && freehandPointsRef.current.length >= 3 && activeVectorPointsRef.current && activeVectorPointsRef.current.length >= 3) {
        const mergedPts = mergePolygonWithStroke(activeVectorPointsRef.current, freehandPointsRef.current);
        if (mergedPts && mergedPts.length >= 3) {
          activeVectorPointsRef.current = mergedPts;
        }
      }
      isDrawingFreehandRef.current = false;
      freehandPointsRef.current = [];

      const updatedMaskB64 = exportBinaryMaskBase64(maskCanvasRef.current);
      const stats = getMaskCanvasStats(maskCanvasRef.current);
      activeMaskVersionRef.current = updatedMaskB64;

      if (onMaskUpdate) {
        onMaskUpdate(updatedMaskB64, stats.bbox, stats.areaPixels);
      }

      if ((mode === 'ADD' || mode === 'ERASE') && activeVectorPointsRef.current && activeVectorPointsRef.current.length >= 3) {
        const finalPts = [...activeVectorPointsRef.current];
        const newBBox = computePolygonBBox(finalPts);
        const newArea = calculatePolygonAreaPixels(finalPts, imageWidth, imageHeight);
        const updatedSel: VectorSelection = {
          ...(vectorSelection || {
            id: `sel_${Date.now()}`,
            isClosed: true,
            isConfirmed: false,
            mode: 'exact',
          }),
          points: finalPts,
          bbox: newBBox,
          areaPixels: newArea,
        };
        const rasterMask = rasterizePolygonToBinaryMask(finalPts, imageWidth, imageHeight);
        onVectorSelectionChange?.(updatedSel, rasterMask);
      }
    }

    renderCanvas();
  };

  const hasSelection = activeVectorPointsRef.current && activeVectorPointsRef.current.length >= 3;

  return (
    <div
      ref={containerRef}
      className="image-viewer-container relative w-full h-full bg-slate-950 overflow-hidden flex items-center justify-center select-none"
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          mousePosRef.current = null;
          mouseImgPosRef.current = null;
          setHoveredVertexIndex(null);
          setHoveredEdgeIndex(null);
          renderCanvas();
        }}
        style={{
          imageRendering: sharpMode ? 'pixelated' : 'auto',
          cursor: isSpacePressed || mode === 'PAN'
            ? (isPanningRef.current ? 'grabbing' : 'grab')
            : cursorStyle,
        }}
        className="w-full h-full"
      />

      {/* FLOATING ACTION TOOLBAR: CONFIRMED SELECTION BADGE & COLOR PICKER */}
      {hasSelection && isConfirmed && (
        <div className="absolute top-3 left-3 flex items-center space-x-2 bg-slate-900/95 backdrop-blur border border-emerald-500/80 rounded-xl px-3.5 py-1.5 shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>CONFIRMED REGION</span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Color Picker Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
              title="Change boundary outline color"
            >
              <span
                className="w-3 h-3 rounded-full border border-white/60 shadow-sm"
                style={{ backgroundColor: confirmedBoundaryColor }}
              />
              <span className="text-[11px]">Outline Color</span>
            </button>

            {showColorPicker && (
              <div className="absolute top-full mt-2 left-0 bg-slate-900 border border-slate-700 rounded-xl p-2 shadow-2xl flex items-center space-x-1.5 z-30">
                {BOUNDARY_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => {
                      setConfirmedBoundaryColor(c.hex);
                      setShowColorPicker(false);
                      renderCanvas();
                    }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      confirmedBoundaryColor === c.hex ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Extract Region Button */}
          {onExtractRegion && (
            <button
              onClick={onExtractRegion}
              className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors"
              title="Extract crop and transparent cutout"
            >
              <Crop className="w-3.5 h-3.5" />
              <span>Extract</span>
            </button>
          )}
        </div>
      )}

      {/* FLOATING ACTION TOOLBAR: RESHAPE CONTROLS */}
      {hasSelection && mode === 'RESHAPE' && !isConfirmed && (
        <div className="absolute top-3 left-3 flex items-center space-x-1.5 bg-slate-900/95 backdrop-blur border border-teal-500/80 rounded-xl px-3 py-1.5 shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center space-x-1 text-xs font-semibold text-teal-300 px-1">
            <Waves className="w-3.5 h-3.5 text-teal-400" />
            <span>Reshape & Sculpt</span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Smooth Curve Button */}
          <button
            onClick={handleSmoothContour}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 text-indigo-300 text-xs font-semibold border border-indigo-700/80 transition-colors"
            title="Smooth out jitter and bumps along the boundary"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Smooth Curve</span>
          </button>

          {/* Trim Spikes Button */}
          <button
            onClick={handleTrimSpikes}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-300 text-xs font-semibold border border-rose-800/80 transition-colors"
            title="Trim needle spikes and acute sharp protrusions from boundary"
          >
            <Scissors className="w-3.5 h-3.5 text-rose-400" />
            <span>Trim Spikes</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Quick Zoom Controls */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleZoomDelta(1.25)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoomDelta(1 / 1.25)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Done Reshaping Button */}
          {setMode && (
            <button
              onClick={() => setMode('FREE_SELECT')}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md transition-colors"
              title="Finish reshaping"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done Reshaping</span>
            </button>
          )}
        </div>
      )}

      {/* FLOATING ACTION TOOLBAR: EDIT VERTICES CONTROLS */}
      {hasSelection && mode === 'EDIT_VERTICES' && !isConfirmed && (
        <div className="absolute top-3 left-3 flex items-center space-x-1.5 bg-slate-900/95 backdrop-blur border border-amber-500/80 rounded-xl px-3 py-1.5 shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-100">
          <span className="text-[11px] font-mono text-amber-300 font-semibold px-1">
            {activeVectorPointsRef.current?.length} Points
          </span>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Smooth Curve Button */}
          <button
            onClick={handleSmoothContour}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 text-indigo-300 text-xs font-semibold border border-indigo-700/80 transition-colors"
            title="Smooth out boundary curve"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Smooth</span>
          </button>

          {/* Trim Spikes Button */}
          <button
            onClick={handleTrimSpikes}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-300 text-xs font-semibold border border-rose-800/80 transition-colors"
            title="Trim sharp needle points and acute hairpin loops automatically"
          >
            <Scissors className="w-3.5 h-3.5 text-rose-400" />
            <span>Trim Spikes</span>
          </button>

          {/* Explicit Add Vertex Button */}
          <button
            onClick={handleInsertVertexExplicit}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 text-xs font-semibold border border-emerald-700/80 transition-colors"
            title="Explicitly add a new point to the boundary"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Add Point</span>
          </button>

          {/* Delete Vertex Button */}
          {selectedVertexIndex !== null && (activeVectorPointsRef.current?.length || 0) > 3 && (
            <button
              onClick={handleDeleteSelectedVertex}
              className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-xs font-semibold border border-rose-800/60 transition-colors"
              title="Delete the currently selected boundary point (Delete / Backspace)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Point</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Quick Zoom Controls */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleZoomDelta(1.25)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoomDelta(1 / 1.25)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Done Editing Button */}
          {setMode && (
            <button
              onClick={() => setMode('FREE_SELECT')}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-colors"
              title="Finish editing vertices and return to clean freehand view"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done Editing</span>
            </button>
          )}
        </div>
      )}

      {/* FLOATING ACTION TOOLBAR: ADD / ERASE CONTROLS */}
      {(mode === 'ADD' || mode === 'ERASE') && (
        <div className={`absolute top-3 left-3 flex items-center space-x-2 bg-slate-900/95 backdrop-blur border ${
          mode === 'ADD' ? 'border-emerald-500/80' : 'border-rose-500/80'
        } rounded-xl px-3 py-1.5 shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-100`}>
          <div className={`flex items-center space-x-1.5 text-xs font-semibold px-1 ${
            mode === 'ADD' ? 'text-emerald-300' : 'text-rose-300'
          }`}>
            {mode === 'ADD' ? (
              <Paintbrush className="w-4 h-4 text-emerald-400" />
            ) : (
              <Eraser className="w-4 h-4 text-rose-400" />
            )}
            <span>{mode === 'ADD' ? 'ADD Brush (Expand Area)' : 'Eraser Controls'}</span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Size Adjuster */}
          <div className="flex items-center space-x-1">
            <span className="text-[11px] text-slate-400">Size:</span>
            <button
              onClick={() => setBrushSize?.(Math.max(1, brushSize <= 5 ? brushSize - 1 : brushSize <= 20 ? brushSize - 2 : brushSize - 5))}
              className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center border border-slate-700"
              title="Decrease Brush Size ([)"
            >
              -
            </button>
            <span className={`font-mono text-xs font-bold px-1.5 ${
              mode === 'ADD' ? 'text-emerald-300' : 'text-rose-300'
            }`}>{brushSize}px</span>
            <button
              onClick={() => setBrushSize?.(Math.min(150, brushSize < 5 ? brushSize + 1 : brushSize < 20 ? brushSize + 2 : brushSize + 5))}
              className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center border border-slate-700"
              title="Increase Brush Size (])"
            >
              +
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Quick Presets */}
          <div className="flex items-center space-x-1">
            {[2, 5, 10, 20, 40, 80].map((sz) => (
              <button
                key={sz}
                onClick={() => setBrushSize?.(sz)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                  brushSize === sz
                    ? mode === 'ADD' ? 'bg-emerald-600 text-white font-bold' : 'bg-rose-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>

          {hasSelection && mode === 'ERASE' && (
            <>
              <div className="h-4 w-px bg-slate-700 mx-0.5" />

              {/* 1-Click Trim Spikes Button */}
              <button
                onClick={handleTrimSpikes}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-300 text-xs font-semibold border border-rose-800/80 transition-colors"
                title="Trim sharp needle points and acute hairpin loops automatically"
              >
                <Scissors className="w-3.5 h-3.5 text-rose-400" />
                <span>Trim Spikes</span>
              </button>
            </>
          )}

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Quick Zoom In / Zoom Out Controls */}
          <div className="flex items-center space-x-1">
            <span className="text-[11px] text-slate-400 mr-0.5">Zoom:</span>
            <button
              onClick={() => handleZoomDelta(1.2)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              title="Zoom In (+ or Scroll Wheel)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoomDelta(1 / 1.2)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              title="Zoom Out (- or Scroll Wheel)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Viewport & Camera Controls */}
      <div className="absolute bottom-4 left-4 flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-1.5 shadow-xl text-xs z-10">
        <button
          onClick={() => handleZoomDelta(1.2)}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 transition-colors"
          title="Zoom In (+20%)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoomDelta(1 / 1.2)}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 transition-colors"
          title="Zoom Out (-20%)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="font-mono text-slate-200 px-2 font-medium">
          {Math.round(displayZoom * 100)}%
        </span>
        {setStrokeWidth && (
          <>
            <div className="h-4 w-px bg-slate-800 mx-1" />
            <div className="flex items-center space-x-1" title="Boundary Line Thickness">
              <span className="text-[11px] text-slate-400">Line:</span>
              <button
                onClick={() => setStrokeWidth(Math.max(0.5, Math.round((strokeWidth <= 3 ? strokeWidth - 0.5 : strokeWidth - 1) * 10) / 10))}
                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center border border-slate-700 transition-transform active:scale-95"
                title="Decrease Line Width (-)"
              >
                -
              </button>
              <span className="font-mono text-xs font-bold text-cyan-300 px-0.5 min-w-[32px] text-center">
                {strokeWidth}px
              </span>
              <button
                onClick={() => setStrokeWidth(Math.min(100, Math.round((strokeWidth < 3 ? strokeWidth + 0.5 : strokeWidth + 1) * 10) / 10))}
                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center border border-slate-700 transition-transform active:scale-95"
                title="Increase Line Width (+)"
              >
                +
              </button>
            </div>
          </>
        )}
        <div className="h-4 w-px bg-slate-800 mx-1" />

        <button
          onClick={() => setSharpMode(!sharpMode)}
          className={`px-2 py-1 rounded transition-colors flex items-center space-x-1 text-xs font-semibold ${
            sharpMode
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 shadow-sm'
              : 'hover:bg-slate-800 text-slate-400'
          }`}
          title="Toggle Crisp HD Mode (Removes bilinear blur on zoom)"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>{sharpMode ? 'Crisp HD' : 'Smooth'}</span>
        </button>
        <div className="h-4 w-px bg-slate-800 mx-1" />

        <button
          onClick={() => handleFocusActiveRegion()}
          className="p-1.5 rounded hover:bg-slate-800 text-medical-400 hover:text-medical-300 transition-colors flex items-center space-x-1"
          title="Focus active region"
        >
          <Target className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-semibold">Focus Region</span>
        </button>

        {regions.length > 1 && (
          <button
            onClick={handleShowAllRegions}
            className="p-1.5 rounded hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 transition-colors flex items-center space-x-1"
            title="Fit all regions into viewport"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-semibold">Show All</span>
          </button>
        )}

        <button
          onClick={fitToScreen}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 transition-colors flex items-center space-x-1"
          title="Fit full slide to viewport"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Fit Slide</span>
        </button>
        <button
          onClick={resetView}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 transition-colors flex items-center space-x-1"
          title="Reset to 100% 1:1 view"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">1:1</span>
        </button>

        {onExportAnnotatedSlide && (
          <>
            <div className="h-4 w-px bg-slate-800 mx-1" />
            <button
              onClick={onExportAnnotatedSlide}
              className="p-1.5 rounded hover:bg-slate-800 text-amber-400 hover:text-amber-300 transition-colors flex items-center space-x-1 font-semibold"
              title="Download full slide image with all marked shape boundaries"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download Slide</span>
            </button>
          </>
        )}
      </div>

      {/* Visual Mode Indicator */}
      <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg px-3 py-1 text-xs z-10 shadow-lg">
        {isConfirmed ? (
          <span className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Selection Confirmed (Solid Boundary Outline)</span>
          </span>
        ) : mode === 'FREE_SELECT' ? (
          <span className="flex items-center space-x-1.5 text-cyan-400 font-semibold">
            <Scissors className="w-3.5 h-3.5" />
            <span>Freehand Selection (Drag to draw organic shape)</span>
          </span>
        ) : mode === 'CIRCLE' ? (
          <span className="flex items-center space-x-1.5 text-indigo-400 font-semibold">
            <Circle className="w-3.5 h-3.5" />
            <span>Circle / Ellipse ROI (Drag to create round nucleus boundary)</span>
          </span>
        ) : mode === 'RESHAPE' ? (
          <span className="flex items-center space-x-1.5 text-teal-400 font-semibold">
            <Waves className="w-3.5 h-3.5" />
            <span>Reshape & Sculpt (Drag boundary to push/pull • Draw across to reshape)</span>
          </span>
        ) : mode === 'EDIT_VERTICES' ? (
          <span className="flex items-center space-x-1.5 text-amber-400 font-semibold">
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Vertices Mode (Drag / Add / Delete control points)</span>
          </span>
        ) : mode === 'ADD' ? (
          <span className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>ADD Mode (Paint to expand selection)</span>
          </span>
        ) : mode === 'ERASE' ? (
          <span className="flex items-center space-x-1.5 text-rose-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>ERASE Mode (Paint to subtract from selection)</span>
          </span>
        ) : (
          <span className="flex items-center space-x-1.5 text-sky-400 font-semibold">
            <Hand className="w-3.5 h-3.5" />
            <span>PAN Mode</span>
          </span>
        )}
      </div>

      {/* Viewport Scale Overlay */}
      <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 font-mono flex items-center space-x-3 pointer-events-none z-10">
        <span>Slide: {imageWidth} × {imageHeight} px</span>
        <span>Zoom: {displayZoom.toFixed(2)}×</span>
      </div>
    </div>
  );
});
