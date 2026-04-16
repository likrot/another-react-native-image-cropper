/**
 * Tunable constants for the cropper gesture and output pipeline.
 * Kept in one place so they are easy to adjust without touching worklets.
 */

/** Multiplier applied on top of `baseScale` to cap how far the user can zoom in. */
export const MAX_ZOOM_MULTIPLIER = 5;

/** JPEG compression passed to `ImageEditor.cropImage`. */
export const OUTPUT_QUALITY = 0.85;

/** Longest-edge cap for the cropped output in pixels. */
export const DEFAULT_MAX_OUTPUT_SIZE = 1600;

/** Spring config used when bouncing back after a pan or pinch release. */
export const SNAP_SPRING_CONFIG = {
  damping: 18,
  stiffness: 180,
  mass: 0.6,
} as const;

/** Semi-transparent overlay behind the crop frame. */
export const DIM_COLOR = 'rgba(0, 0, 0, 0.6)';

/** Semi-transparent background for toolbar/footer elements. */
export const BAR_COLOR = 'rgba(0, 0, 0, 0.55)';

/**
 * Default fraction of the container reserved as margin on each side of
 * the crop frame when an aspect ratio or shape is active. Consumers
 * can override via `ImageCropperModal`'s `framePadding` prop; shapes
 * can carry their own via `Shape.framePadding`.
 */
export const DEFAULT_FRAME_PADDING = 0.06;
