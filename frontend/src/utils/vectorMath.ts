export interface Point2D {
  x: number;
  y: number;
}

let _scratchMaskCanvas: HTMLCanvasElement | null = null;
function getScratchMaskCanvas(width: number, height: number): HTMLCanvasElement {
  if (!_scratchMaskCanvas) {
    _scratchMaskCanvas = document.createElement('canvas');
  }
  if (_scratchMaskCanvas.width !== width || _scratchMaskCanvas.height !== height) {
    _scratchMaskCanvas.width = Math.max(1, width);
    _scratchMaskCanvas.height = Math.max(1, height);
  }
  return _scratchMaskCanvas;
}

/**
 * Computes bounding box [minX, minY, maxX, maxY] of an array of 2D points.
 */
export function computePolygonBBox(points: Point2D[]): [number, number, number, number] {
  if (points.length === 0) return [0, 0, 0, 0];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  return [Math.round(minX), Math.round(minY), Math.round(maxX), Math.round(maxY)];
}

/**
 * Computes the center of a bounding box.
 */
export function computeBBoxCenter(bbox: [number, number, number, number]): Point2D {
  return {
    x: (bbox[0] + bbox[2]) / 2,
    y: (bbox[1] + bbox[3]) / 2,
  };
}

/**
 * Computes combined bounding box across multiple regions/boxes.
 */
export function computeCombinedBBox(
  bboxes: ([number, number, number, number] | null | undefined)[]
): [number, number, number, number] | null {
  const valid = bboxes.filter((b): b is [number, number, number, number] => !!b && (b[2] > b[0] || b[3] > b[1]));
  if (valid.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < valid.length; i++) {
    const b = valid[i];
    if (b[0] < minX) minX = b[0];
    if (b[1] < minY) minY = b[1];
    if (b[2] > maxX) maxX = b[2];
    if (b[3] > maxY) maxY = b[3];
  }

  return [Math.round(minX), Math.round(minY), Math.round(maxX), Math.round(maxY)];
}

/**
 * Calculates optimal camera transform (zoom & pan) to focus and fit a bounding box into the viewport with padding.
 */
export function calculateFitTransform(
  bbox: [number, number, number, number],
  viewportWidth: number,
  viewportHeight: number,
  paddingFactor: number = 0.28,
  minZoom: number = 0.3,
  maxZoom: number = 8.0
): { zoom: number; pan: Point2D } {
  const w = Math.max(10, bbox[2] - bbox[0]);
  const h = Math.max(10, bbox[3] - bbox[1]);
  const cx = (bbox[0] + bbox[2]) / 2;
  const cy = (bbox[1] + bbox[3]) / 2;

  const availW = Math.max(100, viewportWidth * (1 - paddingFactor));
  const availH = Math.max(100, viewportHeight * (1 - paddingFactor));

  const targetZoom = Math.min(availW / w, availH / h);
  const zoom = Math.max(minZoom, Math.min(maxZoom, Number(targetZoom.toFixed(2))));

  const pan: Point2D = {
    x: Math.round(viewportWidth / 2 - cx * zoom),
    y: Math.round(viewportHeight / 2 - cy * zoom),
  };

  return { zoom, pan };
}

/**
 * Ray-casting algorithm to test if a 2D point is inside a closed polygon.
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  const x = point.x;
  const y = point.y;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Distance between two points.
 */
export function distance(p1: Point2D, p2: Point2D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Hit tests all polygon vertices in SCREEN SPACE.
 */
export function findClosestVertex(
  pointerScreen: Point2D,
  vertices: Point2D[],
  zoom: number,
  pan: Point2D,
  hitRadiusScreen: number = 18
): number | null {
  if (vertices.length === 0) return null;

  let minDistance = Infinity;
  let closestIndex: number | null = null;

  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const screenX = v.x * zoom + pan.x;
    const screenY = v.y * zoom + pan.y;

    const dx = pointerScreen.x - screenX;
    const dy = pointerScreen.y - screenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= hitRadiusScreen && dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }

  return closestIndex;
}

/**
 * Distance from point P to line segment AB.
 */
function distToSegmentSquared(p: Point2D, v: Point2D, w: Point2D): { distSq: number; proj: Point2D } {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return { distSq: (p.x - v.x) ** 2 + (p.y - v.y) ** 2, proj: v };
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
  return { distSq: (p.x - proj.x) ** 2 + (p.y - proj.y) ** 2, proj };
}

/**
 * Finds if pointer is near any edge of the polygon in image space.
 */
export function findClosestEdge(
  pointerImg: Point2D,
  vertices: Point2D[],
  maxDistImg: number = 14
): { edgeIndex: number; insertPoint: Point2D } | null {
  if (vertices.length < 3) return null;

  let minDistanceSq = maxDistImg * maxDistImg;
  let bestEdge: { edgeIndex: number; insertPoint: Point2D } | null = null;

  for (let i = 0; i < vertices.length; i++) {
    const nextIdx = (i + 1) % vertices.length;
    const { distSq, proj } = distToSegmentSquared(pointerImg, vertices[i], vertices[nextIdx]);

    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      bestEdge = { edgeIndex: i + 1, insertPoint: proj };
    }
  }

  return bestEdge;
}

/**
 * Inserts a vertex at the specified index.
 */
export function insertVertex(vertices: Point2D[], pt: Point2D, index: number): Point2D[] {
  const next = [...vertices];
  next.splice(index, 0, pt);
  return next;
}

/**
 * Deletes a vertex at index if at least 3 vertices remain.
 */
export function deleteVertex(vertices: Point2D[], index: number): Point2D[] {
  if (vertices.length <= 3) return vertices;
  return vertices.filter((_, i) => i !== index);
}

/**
 * Smooths an entire polygon contour using gentle Laplacian curvature relaxation.
 * Only called when the user explicitly clicks the "Smooth Curve" button.
 */
export function smoothPolygon(points: Point2D[], iterations: number = 2, factor: number = 0.25): Point2D[] {
  if (points.length < 4) return points;

  let current = points.map((p) => ({ ...p }));
  const len = current.length;

  for (let it = 0; it < iterations; it++) {
    const next: Point2D[] = [];
    for (let i = 0; i < len; i++) {
      const prev = current[(i - 1 + len) % len];
      const cur = current[i];
      const nxt = current[(i + 1) % len];

      const avgX = (prev.x + nxt.x) / 2;
      const avgY = (prev.y + nxt.y) / 2;

      next.push({
        x: Math.round(cur.x + (avgX - cur.x) * factor),
        y: Math.round(cur.y + (avgY - cur.y) * factor),
      });
    }
    current = next;
  }

  return current;
}

/**
 * Elastic Push/Pull Sculpting: Smoothly deforms a polygon boundary around a grab point
 * preserving all user details 1:1.
 */
export function elasticDeformPolygon(
  points: Point2D[],
  grabPoint: Point2D,
  delta: Point2D,
  influenceRadius: number = 30
): Point2D[] {
  if (points.length < 3) return points;

  const result: Point2D[] = [];
  const rSq = influenceRadius * influenceRadius;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const dx = pt.x - grabPoint.x;
    const dy = pt.y - grabPoint.y;
    const dSq = dx * dx + dy * dy;

    if (dSq < rSq) {
      const d = Math.sqrt(dSq);
      const weight = 0.5 * (1 + Math.cos((Math.PI * d) / influenceRadius));
      result.push({
        x: Math.round(pt.x + delta.x * weight),
        y: Math.round(pt.y + delta.y * weight),
      });
    } else {
      result.push({ x: pt.x, y: pt.y });
    }
  }

  return result;
}

/**
 * Direct Stroke Reshaping: Slices an existing contour with a newly drawn stroke 1:1.
 * Intelligently identifies which side of the boundary the user drew on and replaces only that segment.
 */
export function spliceReshapeStroke(
  existingPoints: Point2D[],
  reshapeStroke: Point2D[],
  maxSnapDist: number = 50
): Point2D[] | null {
  if (existingPoints.length < 3 || reshapeStroke.length < 2) return null;

  const strokeStart = reshapeStroke[0];
  const strokeEnd = reshapeStroke[reshapeStroke.length - 1];

  let startIdx = -1;
  let startDist = Infinity;
  let endIdx = -1;
  let endDist = Infinity;

  for (let i = 0; i < existingPoints.length; i++) {
    const dStart = distance(strokeStart, existingPoints[i]);
    if (dStart < startDist) {
      startDist = dStart;
      startIdx = i;
    }

    const dEnd = distance(strokeEnd, existingPoints[i]);
    if (dEnd < endDist) {
      endDist = dEnd;
      endIdx = i;
    }
  }

  if (startDist > maxSnapDist || endDist > maxSnapDist || startIdx === -1 || endIdx === -1 || startIdx === endIdx) {
    return null;
  }

  const len = existingPoints.length;

  // Segment A: from startIdx -> endIdx
  const segA: Point2D[] = [];
  let cA = startIdx;
  while (cA !== endIdx) {
    segA.push(existingPoints[cA]);
    cA = (cA + 1) % len;
  }
  segA.push(existingPoints[endIdx]);

  // Segment B: from endIdx -> startIdx
  const segB: Point2D[] = [];
  let cB = endIdx;
  while (cB !== startIdx) {
    segB.push(existingPoints[cB]);
    cB = (cB + 1) % len;
  }
  segB.push(existingPoints[startIdx]);

  const strokeMid = reshapeStroke[Math.floor(reshapeStroke.length / 2)];
  const segAMid = segA[Math.floor(segA.length / 2)];
  const segBMid = segB[Math.floor(segB.length / 2)];

  const distToA = distance(strokeMid, segAMid);
  const distToB = distance(strokeMid, segBMid);

  let newPath: Point2D[] = [];
  if (distToA <= distToB) {
    // Replace segA with stroke: keep segB + stroke
    newPath = [...segB.slice(0, -1), ...reshapeStroke];
  } else {
    // Replace segB with stroke: keep segA + reversed stroke
    newPath = [...segA.slice(0, -1), ...[...reshapeStroke].reverse()];
  }

  return newPath;
}

/**
 * Creates a smooth Circle / Ellipse ROI with 64 points for silky curvature.
 */
export function createEllipsePoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  numPoints: number = 64
): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI;
    pts.push({
      x: Math.round(cx + rx * Math.cos(theta)),
      y: Math.round(cy + ry * Math.sin(theta)),
    });
  }
  return pts;
}

/**
 * Translates/moves all points of a polygon by (dx, dy).
 */
export function translatePolygon(points: Point2D[], dx: number, dy: number): Point2D[] {
  const len = points.length;
  const res = new Array(len);
  for (let i = 0; i < len; i++) {
    res[i] = { x: points[i].x + dx, y: points[i].y + dy };
  }
  return res;
}

/**
 * Scales a polygon around its center by scaleFactor.
 */
export function scalePolygon(points: Point2D[], scaleFactor: number): Point2D[] {
  const bbox = computePolygonBBox(points);
  const cx = (bbox[0] + bbox[2]) / 2;
  const cy = (bbox[1] + bbox[3]) / 2;

  return points.map((p) => ({
    x: Math.round(cx + (p.x - cx) * scaleFactor),
    y: Math.round(cy + (p.y - cy) * scaleFactor),
  }));
}

/**
 * Rasterizes a closed vector polygon onto a binary PNG mask Base64 data URL at full image resolution (W x H).
 */
export function rasterizePolygonToBinaryMask(
  points: Point2D[],
  width: number,
  height: number
): string {
  if (points.length < 3 || width <= 0 || height <= 0) {
    return '';
  }

  const canvas = getScratchMaskCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return '';
  }

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();

  return canvas.toDataURL('image/png');
}

/**
 * Calculates accurate pixel area of a rasterized polygon using Gauss's Shoelace formula.
 */
export function calculatePolygonAreaPixels(
  points: Point2D[],
  width: number,
  height: number
): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.round(Math.abs(area) / 2);
}

/**
 * Calculates exact intersection of line segment P1P2 and line segment P3P4.
 */
export function getSegmentIntersection(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D
): Point2D | null {
  const dx12 = p2.x - p1.x;
  const dy12 = p2.y - p1.y;
  const dx34 = p4.x - p3.x;
  const dy34 = p4.y - p3.y;

  const denom = dy34 * dx12 - dx34 * dy12;
  if (Math.abs(denom) < 1e-8) return null; // Parallel lines

  const ua = (dx34 * (p1.y - p3.y) - dy34 * (p1.x - p3.x)) / denom;
  const ub = (dx12 * (p1.y - p3.y) - dy12 * (p1.x - p3.x)) / denom;

  // Strict interior segment intersection
  if (ua >= 0.001 && ua <= 0.999 && ub >= 0.001 && ub <= 0.999) {
    return {
      x: p1.x + ua * dx12,
      y: p1.y + ua * dy12,
    };
  }

  return null;
}

/**
 * Untangles and removes self-intersecting loops, figure-8 crosses, and self-crossing tails.
 * Slices off the self-crossing loop (spike) and connects the remaining polygon boundary smoothly!
 */
export function removeSelfIntersectionsAndLoops(points: Point2D[]): Point2D[] {
  if (!points || points.length < 4) return points;

  let current = [...points];
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 10 && current.length >= 4) {
    changed = false;
    iterations++;
    const n = current.length;

    for (let i = 0; i < n; i++) {
      const p1 = current[i];
      const p2 = current[(i + 1) % n];

      // Check against all non-adjacent segments
      for (let j = i + 2; j < n; j++) {
        // Skip comparing first and last segment as they connect at p0
        if (i === 0 && j === n - 1) continue;

        const p3 = current[j];
        const p4 = current[(j + 1) % n];

        const intersect = getSegmentIntersection(p1, p2, p3, p4);
        if (intersect) {
          // Found self-intersection!
          // Loop 1: p0..pi, intersect, pj+1..pn-1
          const loop1: Point2D[] = [];
          for (let k = 0; k <= i; k++) loop1.push(current[k]);
          loop1.push(intersect);
          for (let k = j + 1; k < n; k++) loop1.push(current[k]);

          // Loop 2: pi+1..pj + intersect
          const loop2: Point2D[] = [intersect];
          for (let k = i + 1; k <= j; k++) loop2.push(current[k]);

          const area1 = calculatePolygonAreaPixels(loop1, 100000, 100000);
          const area2 = calculatePolygonAreaPixels(loop2, 100000, 100000);

          // Keep the larger main body loop and discard the self-crossing spike/tail!
          current = area1 >= area2 ? loop1 : loop2;
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return current.length >= 3 ? current : points;
}

/**
 * Erases all boundary vertices and sharp spikes that fall within radius R of a circular eraser.
 * Bridges the gap smoothly between the entering and exiting boundary points.
 */
export function erasePolygonVerticesInRadius(
  points: Point2D[],
  center: Point2D,
  radius: number
): Point2D[] {
  if (!points || points.length < 3) return points;

  const isInside = points.map((p) => distance(p, center) <= radius);

  // If ALL points inside eraser, return original
  if (isInside.every(Boolean)) return points;

  let result: Point2D[] = [];

  if (isInside.some(Boolean)) {
    // Delete vertices inside the eraser circle
    result = points.filter((_, idx) => !isInside[idx]);
  } else {
    // Check if eraser circle intersects any boundary edge
    let edgeIntersect = false;
    for (let i = 0; i < points.length; i++) {
      const nextIdx = (i + 1) % points.length;
      const { distSq } = distToSegmentSquared(center, points[i], points[nextIdx]);
      if (distSq <= radius * radius) {
        edgeIntersect = true;
        break;
      }
    }
    if (!edgeIntersect) return points;
    result = [...points];
  }

  // Untangle self-intersections and join remaining boundary parts smoothly!
  result = removeSelfIntersectionsAndLoops(result);
  return result.length >= 3 ? result : points;
}

/**
 * Detects and automatically trims sharp acute spikes, needles, and self-intersecting loops from a polygon.
 */
export function trimPolygonSpikesAndLoops(
  points: Point2D[],
  maxSpikeAngleDeg: number = 40
): Point2D[] {
  if (!points || points.length < 4) return points;

  // Step 1: Remove self-crossing loops and figure-8 tails first
  let current = removeSelfIntersectionsAndLoops(points);

  // Step 2: Perform up to 3 iterative cleaning passes for acute U-turn spikes and hairpin needles
  for (let pass = 0; pass < 3; pass++) {
    const n = current.length;
    if (n < 4) break;

    const toRemove = new Set<number>();

    for (let i = 0; i < n; i++) {
      const prev = current[(i - 1 + n) % n];
      const curr = current[i];
      const next = current[(i + 1) % n];

      // Vector 1: prev -> curr
      const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
      // Vector 2: curr -> next
      const v2 = { x: next.x - curr.x, y: next.y - curr.y };

      const len1 = Math.hypot(v1.x, v1.y);
      const len2 = Math.hypot(v2.x, v2.y);

      if (len1 > 0.001 && len2 > 0.001) {
        const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
        const clampedDot = Math.max(-1, Math.min(1, dot));
        const turnAngleDeg = (Math.acos(clampedDot) * 180) / Math.PI;

        // Sharp U-turn spike (turn angle > 135 deg)
        if (turnAngleDeg > (180 - maxSpikeAngleDeg)) {
          toRemove.add(i);
        }
      }

      // Check for sharp needle loop: if prev and next are extremely close (< 16px) but curr is far out
      const distPrevNext = distance(prev, next);
      const distCurrPrev = distance(curr, prev);
      if (distPrevNext < 16 && distCurrPrev > 10) {
        toRemove.add(i);
      }
    }

    if (toRemove.size === 0) break;

    current = current.filter((_, idx) => !toRemove.has(idx));
    current = removeSelfIntersectionsAndLoops(current);
  }

  return current.length >= 3 ? current : points;
}

/**
 * Expands a vector polygon outward by unioning/pushing the boundary to encompass a circular ADD brush.
 */
export function expandPolygonWithRadius(
  points: Point2D[],
  center: Point2D,
  radius: number
): Point2D[] {
  if (!points || points.length < 3) {
    // If no existing shape, create a smooth initial circle at brush center
    return createEllipsePoints(center.x, center.y, Math.max(5, radius), Math.max(5, radius), 32);
  }

  const n = points.length;
  const dists = points.map((p) => distance(p, center));
  const isInside = dists.map((d) => d <= radius);

  // Calculate polygon centroid
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    cx += points[i].x;
    cy += points[i].y;
  }
  cx /= n;
  cy /= n;

  // Case 1: Some vertices are inside the ADD brush circle
  if (isInside.some(Boolean)) {
    const updated = points.map((p, idx) => {
      if (isInside[idx]) {
        // Push vertex outward along direction from brush center
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001) {
          const pushR = radius + 2;
          return {
            x: center.x + (dx / d) * pushR,
            y: center.y + (dy / d) * pushR,
          };
        } else {
          // Exactly at brush center: push away from polygon centroid
          const cdx = center.x - cx;
          const cdy = center.y - cy;
          const cd = Math.hypot(cdx, cdy) || 1;
          return {
            x: center.x + (cdx / cd) * (radius + 2),
            y: center.y + (cdy / cd) * (radius + 2),
          };
        }
      }
      return p;
    });

    let cleaned = removeSelfIntersectionsAndLoops(updated);
    return smoothPolygon(cleaned, 1, 0.2);
  }

  // Case 2: No vertex inside brush circle, but brush circle intersects an edge
  let minEdgeIdx = -1;
  let minEdgeDistSq = Infinity;
  let closestProj: Point2D | null = null;

  for (let i = 0; i < n; i++) {
    const nextIdx = (i + 1) % n;
    const { distSq, proj } = distToSegmentSquared(center, points[i], points[nextIdx]);
    if (distSq < minEdgeDistSq) {
      minEdgeDistSq = distSq;
      minEdgeIdx = i;
      closestProj = proj;
    }
  }

  // If closest edge is within radius + 10px, push edge outward
  if (minEdgeIdx >= 0 && minEdgeDistSq <= (radius + 10) ** 2 && closestProj) {
    const arcPts: Point2D[] = [];
    const dirX = center.x - closestProj.x;
    const dirY = center.y - closestProj.y;
    const centerAngle = Math.atan2(dirY, dirX);

    for (let k = -3; k <= 3; k++) {
      const ang = centerAngle + (k * (Math.PI / 6));
      arcPts.push({
        x: center.x + Math.cos(ang) * (radius + 2),
        y: center.y + Math.sin(ang) * (radius + 2),
      });
    }

    const newPts: Point2D[] = [];
    for (let i = 0; i < n; i++) {
      newPts.push(points[i]);
      if (i === minEdgeIdx) {
        newPts.push(...arcPts);
      }
    }

    let cleaned = removeSelfIntersectionsAndLoops(newPts);
    return smoothPolygon(cleaned, 1, 0.2);
  }

  return points;
}

/**
 * Merges an existing polygon with a new freehand stroke drawn in ADD mode.
 * Eliminates the inner common line and forms a single unified expanded polygon.
 */
export function mergePolygonWithStroke(
  existingPts: Point2D[],
  strokePts: Point2D[]
): Point2D[] {
  if (!existingPts || existingPts.length < 3) return strokePts;
  if (!strokePts || strokePts.length < 2) return existingPts;

  let poly = [...existingPts];
  const startPt = strokePts[0];
  const endPt = strokePts[strokePts.length - 1];

  // Find projections onto closest edges
  const edgeStart = findClosestEdge(startPt, poly, 300);
  const edgeEnd = findClosestEdge(endPt, poly, 300);

  const inserts: { idx: number; pt: Point2D }[] = [];
  if (edgeStart) inserts.push({ idx: edgeStart.edgeIndex, pt: edgeStart.insertPoint });
  if (edgeEnd) inserts.push({ idx: edgeEnd.edgeIndex, pt: edgeEnd.insertPoint });

  // Sort descending by index so insertion doesn't invalidate subsequent indices
  inserts.sort((a, b) => b.idx - a.idx);
  for (const ins of inserts) {
    poly.splice(ins.idx, 0, ins.pt);
  }

  const n = poly.length;

  let startIdx = 0;
  let minStartDist = Infinity;
  for (let i = 0; i < n; i++) {
    const d = distance(startPt, poly[i]);
    if (d < minStartDist) {
      minStartDist = d;
      startIdx = i;
    }
  }

  let endIdx = 0;
  let minEndDist = Infinity;
  for (let i = 0; i < n; i++) {
    const d = distance(endPt, poly[i]);
    if (d < minEndDist) {
      minEndDist = d;
      endIdx = i;
    }
  }

  if (startIdx === endIdx) return existingPts;

  // Option 1: Path from endIdx -> startIdx around existing polygon + strokePts
  const path1: Point2D[] = [];
  let curr = endIdx;
  while (curr !== startIdx) {
    path1.push(poly[curr]);
    curr = (curr + 1) % n;
  }
  path1.push(poly[startIdx]);
  path1.push(...strokePts);

  // Option 2: Path from startIdx -> endIdx around existing polygon + reversed strokePts
  const path2: Point2D[] = [];
  curr = startIdx;
  while (curr !== endIdx) {
    path2.push(poly[curr]);
    curr = (curr + 1) % n;
  }
  path2.push(poly[endIdx]);
  for (let k = strokePts.length - 1; k >= 0; k--) {
    path2.push(strokePts[k]);
  }

  const area1 = calculatePolygonAreaPixels(path1, 100000, 100000);
  const area2 = calculatePolygonAreaPixels(path2, 100000, 100000);
  const origArea = calculatePolygonAreaPixels(existingPts, 100000, 100000);

  let chosen = area1 >= area2 ? path1 : path2;
  if (calculatePolygonAreaPixels(chosen, 100000, 100000) < origArea) {
    chosen = area1 < area2 ? path1 : path2;
  }

  let cleaned = removeSelfIntersectionsAndLoops(chosen);
  return smoothPolygon(cleaned, 2, 0.25);
}

/**
 * Unions an existing polygon with an ADD brush circle at any distance/location.
 * Expands the vector boundary to swallow the brush area, eliminating common lines.
 */
export function unionPolygonWithCircle(
  points: Point2D[],
  center: Point2D,
  radius: number
): Point2D[] {
  if (!points || points.length < 3) {
    return createEllipsePoints(center.x, center.y, Math.max(5, radius), Math.max(5, radius), 32);
  }

  // 1. Find closest edge on polygon to brush center
  let minEdgeIdx = 0;
  let minEdgeDistSq = Infinity;
  let closestProj: Point2D = points[0];

  for (let i = 0; i < points.length; i++) {
    const nextIdx = (i + 1) % points.length;
    const { distSq, proj } = distToSegmentSquared(center, points[i], points[nextIdx]);
    if (distSq < minEdgeDistSq) {
      minEdgeDistSq = distSq;
      minEdgeIdx = i;
      closestProj = proj;
    }
  }

  // 2. Generate outer arc points of brush circle facing away from closest polygon edge
  const dirX = center.x - closestProj.x;
  const dirY = center.y - closestProj.y;
  const centerAngle = Math.atan2(dirY, dirX);

  const arcPts: Point2D[] = [];
  for (let k = -4; k <= 4; k++) {
    const ang = centerAngle + (k * (Math.PI / 6));
    arcPts.push({
      x: center.x + Math.cos(ang) * radius,
      y: center.y + Math.sin(ang) * radius,
    });
  }

  // 3. Insert arc points into polygon at minEdgeIdx and remove vertices inside circle
  const merged: Point2D[] = [];
  for (let i = 0; i < points.length; i++) {
    if (distance(points[i], center) > radius) {
      merged.push(points[i]);
    }
    if (i === minEdgeIdx) {
      merged.push(...arcPts);
    }
  }

  // 4. Untangle self-intersections and smooth into a clean closed boundary
  let cleaned = removeSelfIntersectionsAndLoops(merged);
  return smoothPolygon(cleaned, 1, 0.2);
}

/**
 * Real-time MS Paint Style Eraser: Subtracts an eraser circle (center, radius) from a vector polygon.
 * Cuts any intersected edges, prunes vertices inside the eraser circle, and bridges the boundary smoothly.
 */
export function subtractCircleFromPolygon(
  points: Point2D[],
  center: Point2D,
  radius: number
): Point2D[] {
  if (!points || points.length < 3) return points;

  const rSq = Math.max(1, radius * radius);

  // Quick check: if no point or edge is near circle, return points unchanged
  let nearCircle = false;
  for (let i = 0; i < points.length; i++) {
    const dSq = (points[i].x - center.x) ** 2 + (points[i].y - center.y) ** 2;
    if (dSq <= rSq) {
      nearCircle = true;
      break;
    }
  }

  if (!nearCircle) {
    for (let i = 0; i < points.length; i++) {
      const nextIdx = (i + 1) % points.length;
      const { distSq } = distToSegmentSquared(center, points[i], points[nextIdx]);
      if (distSq <= rSq) {
        nearCircle = true;
        break;
      }
    }
  }

  if (!nearCircle) return points;

  const inside = points.map((p) => (p.x - center.x) ** 2 + (p.y - center.y) ** 2 <= rSq);

  // If entire shape is inside eraser circle, return empty
  if (inside.every(Boolean)) {
    return [];
  }

  const result: Point2D[] = [];

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const nextIdx = (i + 1) % points.length;
    const next = points[nextIdx];
    const currIn = inside[i];
    const nextIn = inside[nextIdx];

    if (!currIn) {
      result.push(curr);
    }

    if (currIn !== nextIn) {
      // Find intersection of line segment (curr -> next) with circle
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const fx = curr.x - center.x;
      const fy = curr.y - center.y;

      const a = dx * dx + dy * dy;
      const b = 2 * (fx * dx + fy * dy);
      const c = fx * fx + fy * fy - rSq;

      let discriminant = b * b - 4 * a * c;
      if (discriminant >= 0 && a > 1e-6) {
        discriminant = Math.sqrt(discriminant);
        const t1 = (-b - discriminant) / (2 * a);
        const t2 = (-b + discriminant) / (2 * a);

        let t = -1;
        if (t1 >= 0 && t1 <= 1) t = t1;
        else if (t2 >= 0 && t2 <= 1) t = t2;

        if (t >= 0 && t <= 1) {
          result.push({
            x: curr.x + t * dx,
            y: curr.y + t * dy,
          });
        }
      }
    }
  }

  if (result.length < 3) return [];

  let cleaned = removeSelfIntersectionsAndLoops(result);
  return smoothPolygon(cleaned, 1, 0.1);
}

/**
 * Generates RGB Crop and Transparent RGBA Cutout from an HTML Image or Canvas element
 * and polygon/mask. Runs 100% locally in browser memory with 0ms network latency.
 */
export function extractRegionClientSide(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  points: Point2D[],
  paddingPercent: number = 0.05
): {
  cropUrl: string;
  cutoutUrl: string;
  cropBase64: string;
  cutoutBase64: string;
  bbox: [number, number, number, number];
  width: number;
  height: number;
  areaPixels: number;
} {
  const imgW = (imageSource as HTMLImageElement).naturalWidth || imageSource.width || 1000;
  const imgH = (imageSource as HTMLImageElement).naturalHeight || imageSource.height || 1000;

  let bbox = computePolygonBBox(points);
  if (bbox[2] <= bbox[0] || bbox[3] <= bbox[1]) {
    bbox = [0, 0, imgW, imgH];
  }

  const bw = bbox[2] - bbox[0];
  const bh = bbox[3] - bbox[1];
  const padX = Math.round(bw * paddingPercent);
  const padY = Math.round(bh * paddingPercent);

  const x1 = Math.max(0, bbox[0] - padX);
  const y1 = Math.max(0, bbox[1] - padY);
  const x2 = Math.min(imgW, bbox[2] + padX);
  const y2 = Math.min(imgH, bbox[3] + padY);

  const cropW = Math.max(1, x2 - x1);
  const cropH = Math.max(1, y2 - y1);

  // 1. Create RGB Crop Canvas
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cropCtx = cropCanvas.getContext('2d')!;
  cropCtx.drawImage(imageSource, x1, y1, cropW, cropH, 0, 0, cropW, cropH);
  const cropDataUrl = cropCanvas.toDataURL('image/png');

  // 2. Create RGBA Transparent Cutout Canvas
  const cutoutCanvas = document.createElement('canvas');
  cutoutCanvas.width = cropW;
  cutoutCanvas.height = cropH;
  const cutoutCtx = cutoutCanvas.getContext('2d')!;

  if (points && points.length > 0) {
    cutoutCtx.beginPath();
    cutoutCtx.moveTo(points[0].x - x1, points[0].y - y1);
    for (let i = 1; i < points.length; i++) {
      cutoutCtx.lineTo(points[i].x - x1, points[i].y - y1);
    }
    cutoutCtx.closePath();
    cutoutCtx.clip();
  }

  cutoutCtx.drawImage(imageSource, x1, y1, cropW, cropH, 0, 0, cropW, cropH);
  const cutoutDataUrl = cutoutCanvas.toDataURL('image/png');

  // Calculate area via Shoelace formula
  let area = 0;
  if (points && points.length >= 3) {
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    area = Math.abs(area) / 2;
  }
  const areaPixels = Math.round(area > 0 ? area : cropW * cropH);

  return {
    cropUrl: cropDataUrl,
    cutoutUrl: cutoutDataUrl,
    cropBase64: cropDataUrl,
    cutoutBase64: cutoutDataUrl,
    bbox: [x1, y1, x2, y2],
    width: cropW,
    height: cropH,
    areaPixels,
  };
}
