/**
 * Shape protocol. A Shape describes a crop boundary that doubles as the
 * visible frame border and the cutout used in the dim overlay mask.
 *
 * `mask` is either an SVG path string (preferred — compact, easy to store
 * as constants) or a render function returning a ReactElement. Path
 * coordinates live in a 24×24 viewBox (matching Lucide's native format);
 * `ShapeMask` wraps the path in an `<Svg viewBox="0 0 24 24">` and sizes
 * the SVG to the frame dimensions at render time, so no coordinate-math
 * is needed per-shape.
 */

import type { ReactElement } from 'react';

export interface Shape {
  /** Stable identifier — used as the value of the shape picker. */
  id: string;
  /** Optional human label (falls back to `id` when omitted). */
  label?: string;
  /**
   * Locked aspect ratio (width / height), or `null` for free aspect. When
   * locked, the draw-mode corner handles clamp omnidirectionally so the
   * rect stays geometrically correct for the shape.
   */
  aspectRatio: number | null;
  /**
   * SVG path string in a 24×24 viewBox, or a render function. When a
   * string, it's drawn via `<Path d={mask} fill="black"/>` inside the
   * shape mask's SVG. When a function, the returned element is dropped
   * in as-is.
   */
  mask: string | ((viewSize: number) => ReactElement);
  /**
   * Per-shape override for the modal's default `framePadding` in
   * Pan-Zoom mode. Shapes that visually fill their bounding box (square,
   * triangle) can bump this so they don't dominate the crop area; shapes
   * with generous negative space (heart, circle) can leave it unset and
   * inherit the component default. Interpreted as a fraction of the
   * container on each side; valid range `[0, 0.5)`.
   */
  framePadding?: number;
  /**
   * Fraction of the bounding rect that the shape's visible outline
   * leaves empty at each edge — a hint to the crop UI about the shape's
   * "tight" bounds vs. its 24×24 path bbox.
   *
   * Pass a single `number` when the silhouette is symmetric (e.g.
   * circle, star), or `{ x, y }` when horizontal and vertical slack
   * differ (e.g. heart's curves touch the sides closer than its bumps
   * reach the top). `0` = outline reaches the bbox edge; bump up to
   * `<0.5` to tell the Pan-Zoom dim-area resize zones they can extend
   * that far inward.
   */
  outlineInset?: number | { x: number; y: number };
}
