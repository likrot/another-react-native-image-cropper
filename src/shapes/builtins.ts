/**
 * Built-in shapes. Mask paths are the Lucide SVG strings already shipped
 * in `src/constants/icons.ts` (ISC — see NOTICE), reused here as filled
 * regions for the dim-overlay cutout.
 *
 * Rectangle and square share the same full-viewBox mask path — they
 * differ only in aspect-ratio lock.
 *
 * Pan-Zoom's shape-aware resize gesture calls `pointInShape(x, y, w, h)`
 * in a worklet to decide whether a touch falls inside the silhouette.
 * The `(x, y)` coords are bbox-local (touch minus frame origin); `w, h`
 * are the *live* frame bbox — so resizing the crop frame rescales the
 * hit region automatically. Rectangle/square omit the function and fall
 * back to a bbox test (correct — they fill their bbox).
 *
 * All shape geometry is in the Lucide 24-viewBox space; the worklets
 * normalize the incoming `(x, y)` via `(x/w)*24` before testing.
 */

import { ICON_PATHS } from '../constants/icons';
import type { Shape } from './types';

const RECT_MASK = 'M0 0h24v24H0z';

export const rectangleShape: Shape = {
  id: 'rectangle',
  label: 'Rectangle',
  aspectRatio: null,
  mask: RECT_MASK,
  fillsBbox: true,
};

export const squareShape: Shape = {
  id: 'square',
  label: 'Square',
  aspectRatio: 1,
  mask: RECT_MASK,
  // Square fills its bounding box edge-to-edge; the default padding makes
  // it visually overpower shapes that have negative space at the corners.
  // Bump a bit so it reads as "a square on the image", not "most of the image".
  framePadding: 0.15,
  fillsBbox: true,
};

// Lucide circle: r=10 inscribed in the 24-viewBox, centred at (12, 12).
// Scale factor into the live bbox: (10/24) · min(w, h) — `min` guards
// against a non-square bbox (circle is aspect-locked 1:1 so in practice
// w === h, but the worklet should stay correct under any caller).
export const circleShape: Shape = {
  id: 'circle',
  label: 'Circle',
  aspectRatio: 1,
  mask: ICON_PATHS.circle,
  // Circle touches the bbox at 4 cardinal points; all slack lives in
  // the corners. A uniform 10% inset keeps the zones out of the visible
  // outline at the cardinal touchpoints while eating into the empty
  // corner regions.
  outlineInset: 0.1,
  pointInShape: (x, y, w, h) => {
    'worklet';
    const dx = x - w / 2;
    const dy = y - h / 2;
    const r = (10 / 24) * Math.min(w, h);
    return dx * dx + dy * dy <= r * r;
  },
};

// Lucide heart decomposes into two mirror lobes plus a downward-pointing
// V-triangle. Derived directly from the SVG path:
//   - Right lobe: circle arc r=5.5 centred at (16.5, 8.5).
//   - Left lobe:  circle arc r=5.5 centred at  (7.5, 8.5).
//   - V region:   triangle with corners (2, 8.5), (22, 8.5), (12, 21).
// The triangle slightly overshoots the silhouette near the V corners
// (~1-2 viewBox units); this is a conservative false-positive and
// harmless for a gesture zone — touching just outside the heart still
// resolves to the image gesture, not misrouting. Visual reference:
// `docs/media/hit-test-geometry.svg`.
export const heartShape: Shape = {
  id: 'heart',
  label: 'Heart',
  aspectRatio: 1,
  mask: ICON_PATHS.heart,
  // Lucide's heart path spans x=[2, 22], y=[3, 21] in a 24-unit viewBox —
  // 8.3% horizontal slack per side, 12.5% vertical. Use per-axis so the
  // vertical zones can snug up to the bumps and point without the
  // horizontal ones clipping the side curves.
  outlineInset: { x: 0.083, y: 0.125 },
  pointInShape: (x, y, w, h) => {
    'worklet';
    const u = (x / w) * 24;
    const v = (y / h) * 24;
    // Left lobe — circle at (7.5, 8.5), r² = 30.25.
    const lx = u - 7.5;
    const ly = v - 8.5;
    if (lx * lx + ly * ly <= 30.25) return true;
    // Right lobe — circle at (16.5, 8.5), r² = 30.25.
    const rx = u - 16.5;
    const ry = v - 8.5;
    if (rx * rx + ry * ry <= 30.25) return true;
    // V-triangle: linear narrowing from full width at v=8.5 to a point at (12, 21).
    if (v < 8.5 || v > 21) return false;
    const halfWidth = (10 * (21 - v)) / 12.5;
    return Math.abs(u - 12) <= halfWidth;
  },
};

// Lucide star is a 10-vertex polygon (5 outer tips + 5 inner notches)
// with small rounded corners. We approximate each rounded corner by the
// midpoint of its arc endpoints — the sharp-vertex extrapolation is
// within a fraction of a viewBox unit, invisible at gesture resolution.
//
// Parallel X/Y arrays (not a flat pairs list) keep the worklet's inner
// loop arithmetic tight. Order is clockwise starting from the top tip.
const STAR_N = 10;
const STAR_VERTS_X = [
  12.0, 15.583, 21.693, 17.799, 17.99, 12.0, 6.011, 6.202, 2.307, 8.418,
];
const STAR_VERTS_Y = [
  2.295, 7.554, 9.342, 14.371, 20.73, 18.582, 20.73, 14.372, 9.342, 7.554,
];

export const starShape: Shape = {
  id: 'star',
  label: 'Star',
  aspectRatio: 1,
  mask: ICON_PATHS.star,
  // Lucide's star has 5 points that reach the bbox edges, with deep
  // concave arcs between them. A uniform 18% inset lives comfortably in
  // the concave negative space between points on every side.
  outlineInset: 0.18,
  pointInShape: (x, y, w, h) => {
    'worklet';
    const u = (x / w) * 24;
    const v = (y / h) * 24;
    // Even-odd ray-cast against the 10-vertex polygon. Horizontal ray
    // toward +∞ along u; count edge crossings. Odd total → inside.
    let inside = false;
    for (let i = 0, j = STAR_N - 1; i < STAR_N; j = i, i++) {
      const xi = STAR_VERTS_X[i]!;
      const yi = STAR_VERTS_Y[i]!;
      const xj = STAR_VERTS_X[j]!;
      const yj = STAR_VERTS_Y[j]!;
      const crosses =
        yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi;
      if (crosses) inside = !inside;
    }
    return inside;
  },
};

export const builtInShapes: Shape[] = [
  rectangleShape,
  squareShape,
  circleShape,
  heartShape,
  starShape,
];
