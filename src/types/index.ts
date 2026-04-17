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
   * Cropped image URI. Three possible forms:
   *
   * - **`file://…`** — default. Path written by
   *   `@react-native-community/image-editor` for a standard rect crop.
   * - **`data:image/png;base64,…`** — when `outputMask` is set, or
   *   when `outputCutout` is set without an `onBytes` callback. Render
   *   directly in `<Image>`, or strip the prefix and hand the base64
   *   string to any fs library (`react-native-fs`,
   *   `react-native-blob-util`, `expo-file-system`) to persist as a
   *   file.
   * - **Consumer-supplied string** — when `outputCutout.onBytes` is
   *   set, whatever string the callback returns becomes this `uri`
   *   (commonly a `file://` to a path the consumer wrote themselves).
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

/**
 * Post-crop shape-cutout options. Produces a PNG trimmed to the
 * active shape's tight bounding box, alpha-transparent outside the
 * silhouette. Distinct from `OutputMask`, which keeps the full crop
 * rect and only paints non-shape pixels.
 *
 * No-op for the free-aspect rectangle shape and for function-form
 * custom shapes (no SVG path to introspect). Requires
 * `@shopify/react-native-skia` as an optional peer dependency.
 */
export interface OutputCutout {
  /**
   * Fill color for pixels outside the shape silhouette but inside
   * the tight bbox. Defaults to `'transparent'`. Accepts any
   * RN-compatible color string — same rules as `OutputMask.color`.
   */
  color?: string;
  /** Optional stroke drawn on the shape silhouette. */
  stroke?: {
    color: string;
    /** Width in output pixels. Default `1`. */
    width?: number;
  };
  /** Extra transparent padding (px) around the tight bbox. Default `0`. */
  padding?: number;
  /**
   * Optional persistence hook. When set, the library hands the
   * composited PNG bytes to the callback instead of emitting a
   * base64 data URI; the string you return becomes `CropResult.uri`.
   * Use this to write the file yourself (RNFS, expo-file-system,
   * blob-util, …), upload, or cache without a base64 decode step.
   *
   * When absent, `CropResult.uri` is `data:image/png;base64,…`.
   */
  onBytes?: (
    bytes: Uint8Array,
    meta: { width: number; height: number; format: 'png' }
  ) => Promise<string> | string;
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
