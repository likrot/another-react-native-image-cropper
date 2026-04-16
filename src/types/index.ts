/**
 * Public types for the image-cropper module.
 *
 * Coordinate model: there are two spaces the math has to move between.
 *   - "Source space" — pixels in the original image (`sourceWidth` × `sourceHeight`).
 *   - "Container space" — device-independent points inside the modal's crop area.
 *
 * A crop is described in source space (what `ImageEditor.cropImage` needs):
 * `offset` is the top-left of the cropped rectangle and `size` its dimensions,
 * both in source pixels.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** A rectangle in source-pixel coordinates — what `ImageEditor.cropImage` consumes. */
export interface CropRect {
  offset: Point;
  size: Size;
}

/** Result delivered to `onConfirm` once the native crop finishes. */
export interface CropResult {
  /**
   * Cropped image URI. For standard crops this is a `file://` path
   * written by `@react-native-community/image-editor`. When
   * `outputMask` is set on `ImageCropperModal`, it's a base64 data URI
   * (`data:image/png;base64,...`) — render it directly in `<Image>`, or
   * strip the prefix and hand the base64 string to any fs library
   * (`react-native-fs`, `react-native-blob-util`, `expo-file-system`)
   * to persist as a file.
   */
  uri: string;
  width: number;
  height: number;
}

/**
 * Post-crop shape-masking options. When set on `ImageCropperModal`, the
 * rectangular output from `@react-native-community/image-editor` is run
 * through a Skia composite: pixels inside the active shape's path keep
 * the image; pixels outside get `color` (defaulting to transparent).
 * An optional `stroke` is drawn along the path — handy when `color` is
 * transparent and you still want the silhouette visible.
 *
 * Requires `@shopify/react-native-skia` as an optional peer dependency.
 * No-op for the free-aspect rectangle shape (nothing to mask).
 */
export interface OutputMask {
  /**
   * Fill color for pixels outside the shape's silhouette. Any
   * RN-compatible color string. Use `'transparent'` (default) or an
   * `rgba` with `alpha=0` for an alpha cutout.
   */
  color?: string;
  /** Optional stroke along the shape path. */
  stroke?: {
    color: string;
    /** Width in output pixels. Default `1`. */
    width?: number;
  };
}

/** Output file format for the native rect crop. `outputMask` forces PNG regardless. */
export type OutputFormat = 'jpeg' | 'png';

/** A rectangle in container coordinates used by draw-mode to describe the user's selection. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Crop interaction mode. */
export type CropMode = 'pan-zoom' | 'draw';

/**
 * Where the toolbar sits on screen. `'auto'` lays out top-center in
 * portrait, right edge in landscape. Other values are explicit
 * placements. `'hidden'` renders no toolbar — the consumer drives the
 * modal via the imperative ref.
 */
export type ToolbarPosition =
  | 'auto'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'hidden';

/** Per-element style overrides for the crop frame border. */
export interface FrameStyle {
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
}

/** Per-element style overrides for the draw-mode corner handles. */
export interface HandleStyle {
  armLength?: number;
  armThickness?: number;
  color?: string;
  /** Touch target size (square). Defaults to 56. */
  hitSize?: number;
}

/**
 * Imperative API exposed via `forwardRef` on `ImageCropperModal`. Useful
 * when `toolbarPosition` is `'hidden'` — the consumer drives confirm/cancel
 * from their own UI.
 */
export interface ImageCropperHandle {
  /** Triggers the native crop using the current selection. */
  confirm: () => Promise<void>;
  /** Closes the modal without cropping. */
  cancel: () => void;
  /** Switches the active interaction mode. */
  setMode: (mode: CropMode) => void;
}
