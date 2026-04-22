import type { ReactNode } from 'react';

import type { Theme } from '../../constants/theme';
import type { IconOverrideMap } from '../../context/IconContext';
import type { Shape } from '../../shapes';
import type {
  CropMode,
  CropResult,
  FrameStyle,
  HandleStyle,
  OutputCutout,
  OutputFormat,
  OutputMask,
  ToolbarPosition,
} from '../../types';
import type { DeepPartial } from '../../utils/mergeTheme';

export interface ImageCropperLabels {
  /** Label for the confirm button that triggers the native crop. */
  confirm: string;
  /** Label for the cancel button that dismisses the modal without cropping. */
  cancel: string;
  /** Helper copy shown in the footer while the user frames the image. */
  instructions: string;
  /** Message shown in the footer if `ImageEditor.cropImage` rejects. */
  errorMessage: string;
  /**
   * Accessibility labels for the mode picker buttons. Any subset;
   * unspecified modes fall through to English defaults. Pass your
   * own translations for localized apps.
   */
  modes?: Partial<Record<CropMode, string>>;
}

/** Props passed to a consumer-supplied `renderToolbar` override. */
export interface ToolbarRenderProps {
  mode: CropMode;
  modes: CropMode[];
  onModeChange: (mode: CropMode) => void;
  shape: Shape;
  shapes: Shape[];
  onShapeChange: (shape: Shape) => void;
  onCancel: () => void;
  onConfirm: () => void;
  labels: ImageCropperLabels;
  disabled: boolean;
  /** True when the modal is in a landscape-oriented layout. */
  isLandscape: boolean;
}

/** Props passed to a consumer-supplied `renderFooter` override. */
export interface FooterRenderProps {
  instructions: string;
  /** Current error message, or null. */
  error: string | null;
}

export interface ImageCropperModalProps {
  /** Controls modal visibility. */
  visible: boolean;
  /** Local file URI of the image to crop (e.g. from `react-native-image-picker`). */
  sourceUri: string;
  /** Natural pixel width of the source image. Required for correct geometry. */
  sourceWidth: number;
  /** Natural pixel height of the source image. Required for correct geometry. */
  sourceHeight: number;
  /** Frame aspect (width / height). Omit for a free-aspect frame that fills the container. */
  aspectRatio?: number;
  /**
   * Fraction of the container reserved as margin on each side of the
   * crop rect when a shape / aspect ratio is active. In Pan-Zoom it
   * insets the static or resizable frame; in Draw it shrinks the
   * initial rect below the image size so the user has immediate
   * movement room. `0` = edge-to-edge; the default `0.06` leaves ~6%
   * margin on each side. Ignored for free-aspect (no `aspectRatio`,
   * no `shapes`) — the rect still fills the image.
   */
  framePadding?: number;

  /**
   * Interaction modes enabled for this session. With one entry the mode
   * picker is hidden and the modal opens straight into that mode. With two
   * or more, the picker is shown. Defaults to `['pan-zoom', 'draw']`.
   */
  modes?: CropMode[];
  /**
   * Active mode on open. Defaults to the first entry of `modes`. Must be a
   * member of `modes`.
   */
  defaultMode?: CropMode;
  /** Fires when the user toggles between modes. */
  onModeChange?: (mode: CropMode) => void;

  /**
   * Shapes available for cropping. Each shape drives the frame outline
   * and the dim-overlay cutout in both interaction modes — in Pan-Zoom
   * the cutout is static; in Draw it tracks the selection rect as corner
   * handles are dragged. When length === 1 the shape picker is hidden.
   * Omit to stay on the free-aspect rectangular default.
   */
  shapes?: Shape[];
  /** Initial shape — accepts either a Shape instance or its `id`. */
  defaultShape?: Shape | string;
  /** Fires when the user picks a different shape. */
  onShapeChange?: (shape: Shape) => void;

  /** Longest-edge cap on the cropped output, in pixels. Defaults to `DEFAULT_MAX_OUTPUT_SIZE`. */
  maxOutputSize?: number;
  /** JPEG compression in `[0, 1]` passed to `ImageEditor.cropImage`. Defaults to `OUTPUT_QUALITY`. Ignored for PNG. */
  outputQuality?: number;
  /**
   * Output image format for the native rect crop. `'jpeg'` (default) or
   * `'png'`. When `outputMask` is set, the output is always PNG
   * (JPEG can't carry alpha) regardless of this prop.
   */
  outputFormat?: OutputFormat;
  /**
   * Post-process the native crop with a shape-mask composite. Pixels
   * inside the active shape's path keep the image; pixels outside get
   * `color` (default `'transparent'`). Optional `stroke` draws the
   * silhouette over the top. Output is a base64 PNG data URI in
   * `CropResult.uri`. No-op when the active shape is the free-aspect
   * rectangle. Requires `@shopify/react-native-skia` as a peer
   * dependency.
   */
  outputMask?: OutputMask;
  /**
   * Post-process the crop into a PNG trimmed to the active shape's
   * tight bounding box, alpha-transparent outside the silhouette —
   * for avatars, stickers, etc. Distinct from `outputMask` (which
   * keeps the full crop-rect size). Mutually exclusive with
   * `outputMask`. No-op when the active shape is rectangle or a
   * function-form mask. Requires `@shopify/react-native-skia`.
   */
  outputCutout?: OutputCutout;

  /** UI copy. The library is i18n-agnostic — pass your own translated strings here. */
  labels: ImageCropperLabels;
  /** Called with the cropped file URI and its dimensions after a successful crop. */
  onConfirm: (result: CropResult) => void;
  /** Called when the user dismisses the modal without cropping. */
  onCancel: () => void;
  /**
   * Optional callback invoked when the underlying native crop fails. The
   * modal still surfaces the error visually via `labels.errorMessage`; this
   * hook lets the consumer log/track/retry without losing the inline UX.
   */
  onError?: (error: unknown) => void;

  /**
   * Partial theme override. Deep-merged onto `defaultTheme`. Pass any
   * subset — unspecified tokens fall through to defaults. Layout spacing
   * outside colors/typography is pinned to defaults; use `frameStyle` /
   * `handleStyle` for layout-specific overrides.
   */
  theme?: DeepPartial<Theme>;
  /**
   * Override individual toolbar / shape icons. Each entry can be a
   * ReactNode or a function `(IconRenderProps) => ReactNode`. Falls back
   * to the bundled Lucide SVG path for unspecified names.
   *
   * **Keep the reference stable** — define the map at module level or
   * memoize it with `useMemo`. Passing a fresh object literal on every
   * render rebuilds the internal icon resolver each frame and causes
   * every toolbar/shape button to re-render.
   */
  icons?: IconOverrideMap;
  /**
   * Where the toolbar sits. `'auto'` is portrait-top / landscape-right
   * vertical. `'hidden'` renders no toolbar — drive the modal via the
   * imperative ref, or supply `renderToolbar` for a custom chrome.
   * Defaults to `'auto'`.
   */
  toolbarPosition?: ToolbarPosition;
  /** Hide the instruction / error pill. Defaults to `true` (shown). */
  showFooter?: boolean;
  /** Border overrides for the frame / selection rect. */
  frameStyle?: FrameStyle;
  /** Styling overrides for the draw-mode corner handles. */
  handleStyle?: HandleStyle;
  /**
   * Development visualization for gesture hit regions. The Pan-Zoom
   * overlay is loaded behind a `__DEV__` guard, so release bundles
   * strip it and this prop is a silent no-op in production.
   *
   * - `false` / omitted — off.
   * - `true` / `'tint'` — amber tint in the area outside the shape
   *   silhouette (Pan-Zoom), and a tinted rect-interior move handle
   *   (Draw). One masked `<Rect>` per region; cheap.
   * - `'grid'` — tint plus a 15×15 grid sampling
   *   `Shape.pointInShape(...)` as green (inside) / red (outside)
   *   dots. Useful for verifying a custom shape's hit-test.
   */
  debug?: boolean | 'tint' | 'grid';
  /**
   * Replace the entire toolbar. Receives state + handlers. Bypasses the
   * theme / icons / toolbarPosition machinery — you're on your own.
   */
  renderToolbar?: (props: ToolbarRenderProps) => ReactNode;
  /**
   * Replace the entire footer pill. Receives the current instruction /
   * error strings.
   */
  renderFooter?: (props: FooterRenderProps) => ReactNode;
}
