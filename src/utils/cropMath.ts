/**
 * Pure geometry helpers. JS-thread-safe so every derivation can be
 * reasoned about and unit-tested in isolation.
 *
 * Coordinate model:
 *
 *   ┌─────────── container (crop area) ───────────┐
 *   │                                             │
 *   │         ┌─────── frame ───────┐             │  ← dim letterbox cutout
 *   │         │                     │             │
 *   │         │    image (panned,   │             │
 *   │         │      zoomed)        │             │
 *   │         └─────────────────────┘             │
 *   │                                             │
 *   └─────────────────────────────────────────────┘
 *
 * `baseScale` = scale at which the untransformed image exactly fits
 * inside the frame (contain). Pinch multiplies `baseScale` by
 * `scale` ≥ 1.
 */

import type { CropRect, Rect, Size } from '../types';

/**
 * Frame rectangle (in container space) that fits inside `container` while
 * honouring the requested aspect ratio. If `aspectRatio` is omitted the frame
 * fills the container (free aspect).
 */
export const computeFrameSize = (
  container: Size,
  aspectRatio?: number
): Size => {
  if (!aspectRatio || aspectRatio <= 0) {
    return { width: container.width, height: container.height };
  }
  const widthDriven = {
    width: container.width,
    height: container.width / aspectRatio,
  };
  if (widthDriven.height <= container.height) {
    return widthDriven;
  }
  return { width: container.height * aspectRatio, height: container.height };
};

/**
 * Scale at which the source image is fully visible inside the frame (contain
 * fit). At this scale the longer axis of the image matches the corresponding
 * frame edge and the shorter axis leaves a gap — the whole image is in view,
 * ready for the user to zoom in and pick a region.
 */
export const computeBaseScale = (source: Size, frame: Size): number => {
  'worklet';
  if (source.width <= 0 || source.height <= 0) return 0;
  return Math.min(frame.width / source.width, frame.height / source.height);
};

/**
 * Maximum pan translation along one axis given the currently displayed image
 * size and frame size. Translation is measured from the centered resting
 * position, so the allowed range is symmetric: `[-limit, +limit]`.
 *
 * When the displayed image is smaller than the frame along an axis, the limit
 * is 0 — there's nothing to pan. Marked as a worklet so it can be called
 * directly from pan/pinch `onEnd` handlers on the UI thread.
 */
export const computePanLimit = (
  displayedEdge: number,
  frameEdge: number
): number => {
  'worklet';
  return Math.max(0, (displayedEdge - frameEdge) / 2);
};

/**
 * Convert the current pan/zoom state into a source-pixel crop rectangle.
 *
 * Derivation (x axis, y analogous) when the displayed image is at least as
 * wide as the frame:
 *   displayed.w = source.w * baseScale * scale
 *   frameLeftInDisplayed.x = (displayed.w - frame.w) / 2 - translate.x
 *   offset.x = frameLeftInDisplayed.x / (baseScale * scale)
 *   size.w   = frame.w              / (baseScale * scale)
 *
 * When the displayed image is narrower than the frame (contain fit at rest),
 * the frame would reach past the image edge. We snap to the whole image on
 * that axis: `offset.x = 0`, `size.w = source.w`. Same idea vertically.
 *
 * The returned rect is clamped into the source image bounds — floating-point
 * drift at the edges must not push `offset + size` past the real dimensions
 * or the native cropper will throw.
 */
export const computeCropRect = (args: {
  source: Size;
  frame: Size;
  scale: number;
  translateX: number;
  translateY: number;
}): CropRect => {
  const { source, frame, scale, translateX, translateY } = args;
  const baseScale = computeBaseScale(source, frame);
  const totalScale = baseScale * scale;

  const displayedWidth = source.width * totalScale;
  const displayedHeight = source.height * totalScale;

  let sizeW: number;
  let offsetX: number;
  if (displayedWidth >= frame.width) {
    sizeW = frame.width / totalScale;
    const rawOffsetX = (displayedWidth - frame.width) / 2 - translateX;
    const maxX = Math.max(0, source.width - sizeW);
    offsetX = Math.min(Math.max(rawOffsetX / totalScale, 0), maxX);
  } else {
    sizeW = source.width;
    offsetX = 0;
  }

  let sizeH: number;
  let offsetY: number;
  if (displayedHeight >= frame.height) {
    sizeH = frame.height / totalScale;
    const rawOffsetY = (displayedHeight - frame.height) / 2 - translateY;
    const maxY = Math.max(0, source.height - sizeH);
    offsetY = Math.min(Math.max(rawOffsetY / totalScale, 0), maxY);
  } else {
    sizeH = source.height;
    offsetY = 0;
  }

  return {
    offset: { x: offsetX, y: offsetY },
    size: { width: sizeW, height: sizeH },
  };
};

/**
 * Convert an arbitrary rectangle drawn in container coordinates into a
 * source-pixel crop rectangle, given the current image pan/zoom state.
 *
 * Same math as `computeCropRect` but starts from a user-positioned rectangle
 * instead of a fixed centered frame. The caller supplies the image's resting
 * origin and displayed dimensions directly, so asymmetric layouts (e.g.
 * DrawMode with uneven padding) work correctly.
 *
 * Per axis:
 *   totalScale   = (displayedWidth / source.width) × scale
 *   displayedW   = displayedWidth × scale
 *   imgOrigX     = imageOriginX + (displayedWidth − displayedW) / 2 + translateX
 *   cropOffset   = (rect.origin − imgOrigX) / totalScale
 *   cropSize     = rect.size / totalScale
 */
export const computeCropRectFromRect = (args: {
  source: Size;
  imageOriginX: number;
  imageOriginY: number;
  displayedWidth: number;
  displayedHeight: number;
  rect: Rect;
  scale: number;
  translateX: number;
  translateY: number;
}): CropRect => {
  const {
    source,
    imageOriginX,
    imageOriginY,
    displayedWidth,
    displayedHeight,
    rect,
    scale,
    translateX,
    translateY,
  } = args;

  const totalScale = (displayedWidth / source.width) * scale;

  const displayedW = displayedWidth * scale;
  const displayedH = displayedHeight * scale;

  const imgOrigX =
    imageOriginX + (displayedWidth - displayedW) / 2 + translateX;
  const imgOrigY =
    imageOriginY + (displayedHeight - displayedH) / 2 + translateY;

  let cropW = Math.min(rect.w / totalScale, source.width);
  let cropH = Math.min(rect.h / totalScale, source.height);

  let cropX = (rect.x - imgOrigX) / totalScale;
  let cropY = (rect.y - imgOrigY) / totalScale;

  cropX = Math.max(0, Math.min(cropX, source.width - cropW));
  cropY = Math.max(0, Math.min(cropY, source.height - cropH));

  cropW = Math.min(cropW, source.width - cropX);
  cropH = Math.min(cropH, source.height - cropY);

  return {
    offset: { x: cropX, y: cropY },
    size: { width: cropW, height: cropH },
  };
};

/**
 * Compute the live image bounds in container space given the resting position
 * and the current zoom/pan transform. Used by both the animated reaction
 * (clamp on zoom-out) and CornerHandle (clamp on drag).
 *
 * Returns `{ minX, maxX, minY, maxY }` — the rectangle the image currently
 * occupies, clamped to the container viewport.
 */
export const computeImageBounds = (args: {
  imageLeft: number;
  imageTop: number;
  displayedWidth: number;
  displayedHeight: number;
  containerWidth: number;
  containerHeight: number;
  scale: number;
  translateX: number;
  translateY: number;
}): { minX: number; maxX: number; minY: number; maxY: number } => {
  'worklet';
  const {
    imageLeft,
    imageTop,
    displayedWidth,
    displayedHeight,
    containerWidth,
    containerHeight,
    scale,
    translateX,
    translateY,
  } = args;
  const imgCx = imageLeft + displayedWidth / 2 + translateX;
  const imgCy = imageTop + displayedHeight / 2 + translateY;
  const halfW = (displayedWidth * scale) / 2;
  const halfH = (displayedHeight * scale) / 2;
  return {
    minX: Math.max(0, imgCx - halfW),
    maxX: Math.min(containerWidth, imgCx + halfW),
    minY: Math.max(0, imgCy - halfH),
    maxY: Math.min(containerHeight, imgCy + halfH),
  };
};

/**
 * Top-left coordinates that center a `w × h` rectangle inside a
 * container of size `containerW × containerH`. Values may be
 * negative if the rect is larger than the container.
 */
export const centerRect = (
  containerW: number,
  containerH: number,
  w: number,
  h: number
): { x: number; y: number } => ({
  x: (containerW - w) / 2,
  y: (containerH - h) / 2,
});

/**
 * Cap the cropped output's longer side to `maxOutputSize`, preserving aspect.
 * Returns `undefined` when no downscale is needed so the caller can omit
 * `displaySize` entirely (the native cropper then emits original-resolution
 * pixels from the rect).
 */
export const computeDisplaySize = (
  rect: Size,
  maxOutputSize: number
): Size | undefined => {
  const longer = Math.max(rect.width, rect.height);
  if (longer <= maxOutputSize) return undefined;
  const ratio = maxOutputSize / longer;
  return {
    width: Math.round(rect.width * ratio),
    height: Math.round(rect.height * ratio),
  };
};
