/**
 * SVG `<Mask>` IDs used by the library's overlay components. Each
 * overlay renders in its own `<Svg>` tree, so these don't collide
 * today — but `<Mask id>` is document-scoped within an SVG, and two
 * overlays sharing an ID inside the same tree would silently resolve
 * to whichever was last defined. Keeping distinct IDs centralized
 * makes that invariant visible and diff-checkable.
 */

/** Static shape mask used by `ShapeMask` (non-animated dim overlay). */
export const SHAPE_MASK_ID = 'arnic-shape-mask';

/** Animated shape cutout used by `ShapeCutoutLayer` (Pan-Zoom + Draw). */
export const SHAPE_CUTOUT_MASK_ID = 'arnic-shape-cutout';

/** Pan-Zoom debug tint cutout used by `PanZoomDebugOverlay`. */
export const PAN_ZOOM_DEBUG_MASK_ID = 'arnic-pz-debug-mask';
