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
  /**
   * Hit-test worklet. Given a touch in bbox-local coordinates,
   * returns `true` iff the point lies inside the silhouette.
   *
   * Parameters:
   * - `x`, `y` — touch position with origin at the frame bbox
   *   top-left, in the same pixel units as `w`/`h`.
   * - `w`, `h` — current bbox dimensions. The caller passes the
   *   **live** frame size on every touch, so the hit region tracks
   *   the crop frame as the user resizes it. Do NOT close over a
   *   size captured at shape-definition time.
   *
   * **Must be a Reanimated worklet** — annotate the function body
   * with the `'worklet'` directive so the Reanimated Babel plugin
   * inlines it onto the UI thread. Calls from non-worklet JS
   * context will throw at the first invocation. See
   * https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/worklets/.
   *
   * Inside the worklet, normalize `(x, y)` into your shape's native
   * coordinate system before testing. Built-in shapes use the 24×24
   * Lucide viewBox, e.g.
   *
   * ```ts
   * pointInShape: (x, y, w, h) => {
   *   'worklet';
   *   const u = (x / w) * 24;  // viewBox-local
   *   const v = (y / h) * 24;
   *   // ...closed-form test against constants in 24-viewBox space
   *   return u * u + v * v <= 144;
   * }
   * ```
   *
   * Restrictions inside the worklet: only synchronous, pure JS; no
   * `console.log` (use `runOnJS` if needed); no module-scope
   * bindings that weren't captured at plugin-time. See
   * `src/shapes/builtins.ts` for reference implementations of
   * circle, heart, and star.
   *
   * Omit for shapes that fill their bounding box (rectangle,
   * square); the consumer falls back to a bbox test.
   */
  pointInShape?: (x: number, y: number, w: number, h: number) => boolean;
  /**
   * Optimization hint: when `true`, the silhouette equals the
   * bounding box (rectangle, square, …). The crop UI skips the
   * SVG-mask render path and uses four `Animated.View` dim strips
   * instead — materially cheaper during resize, especially on
   * Android. Leave undefined for curved silhouettes; set `true` only
   * when the shape literally fills its bbox.
   */
  fillsBbox?: boolean;
}
