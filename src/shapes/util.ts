import { DEFAULT_FRAME_PADDING } from '../constants/cropping';
import type { Shape } from './types';

/**
 * True when `shape` needs the SVG-cutout dim renderer. Bbox-filling
 * shapes (`fillsBbox: true`) return `false` — callers route them to
 * the cheaper four-rectangle dim overlay.
 */
export const isShapedOverlay = (shape: Shape | undefined): boolean =>
  shape !== undefined && shape.fillsBbox !== true;

/**
 * True when the output pipeline can post-process a crop with the
 * shape's path. Narrower than `isShapedOverlay` because the Skia
 * composite needs an SVG path string; function-form masks fall
 * through to the plain rectangular crop.
 */
export const isOutputMaskableShape = (shape: Shape | undefined): boolean =>
  isShapedOverlay(shape) && typeof shape!.mask === 'string';

/**
 * Resolve the effective frame padding for the active shape. Per-shape
 * overrides (e.g. square's 0.15) win over the modal's prop; the prop
 * wins over the library default.
 */
export const resolveFramePadding = (
  shape: Shape | undefined,
  prop: number | undefined
): number => shape?.framePadding ?? prop ?? DEFAULT_FRAME_PADDING;
