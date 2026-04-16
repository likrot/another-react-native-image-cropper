/**
 * Built-in shapes. Mask paths are the Lucide SVG strings already shipped
 * in `src/constants/icons.ts` (ISC — see NOTICE), reused here as filled
 * regions for the dim-overlay cutout.
 *
 * Rectangle and square share the same full-viewBox mask path — they
 * differ only in aspect-ratio lock.
 */

import { ICON_PATHS } from '../constants/icons';
import type { Shape } from './types';

const RECT_MASK = 'M0 0h24v24H0z';

export const rectangleShape: Shape = {
  id: 'rectangle',
  label: 'Rectangle',
  aspectRatio: null,
  mask: RECT_MASK,
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
};

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
};

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
};

export const starShape: Shape = {
  id: 'star',
  label: 'Star',
  aspectRatio: 1,
  mask: ICON_PATHS.star,
  // Lucide's star has 5 points that reach the bbox edges, with deep
  // concave arcs between them. A uniform 18% inset lives comfortably in
  // the concave negative space between points on every side.
  outlineInset: 0.18,
};

export const builtInShapes: Shape[] = [
  rectangleShape,
  squareShape,
  circleShape,
  heartShape,
  starShape,
];
