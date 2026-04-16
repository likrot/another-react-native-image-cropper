/**
 * Post-crop shape-mask composite via `@shopify/react-native-skia`.
 *
 * Pipeline: decode image → redraw onto surface → clip out the shape
 * path and fill the remaining region with the mask color → optional
 * stroke on top → encode PNG → base64 data URI.
 *
 * Skia is loaded via a dynamic `require` so consumers that never set
 * `outputMask` don't need the peer installed. A missing peer raises a
 * clear install-hint error through the modal's existing try/catch.
 */

import { LOG_PREFIX } from '../constants/library';
import type { OutputMask } from '../types';

const MISSING_SKIA_MESSAGE =
  'outputMask requires @shopify/react-native-skia. Install it as a peer dependency (and re-run `pod install` on iOS), or remove the outputMask prop.';

/**
 * Narrow projection of the Skia module surface this util depends on.
 * Keeping it local — rather than importing types from Skia — keeps the
 * library buildable when the peer isn't installed at all.
 */
interface SkiaModule {
  Skia: {
    Image: {
      MakeImageFromEncoded(data: unknown): {
        width(): number;
        height(): number;
      } | null;
    };
    Data: {
      fromURI(uri: string): Promise<unknown>;
      fromBase64(s: string): unknown;
    };
    Surface: {
      Make(
        width: number,
        height: number
      ): {
        getCanvas(): SkCanvas;
        makeImageSnapshot(): {
          encodeToBase64(format: number, quality?: number): string;
        };
      } | null;
    };
    Path: {
      MakeFromSVGString(svg: string): SkPath | null;
    };
    Matrix(): {
      scale(sx: number, sy: number): void;
    };
    Paint(): SkPaint;
    Color(c: string): number;
  };
  ClipOp: { Difference: number; Intersect: number };
  PaintStyle: { Fill: number; Stroke: number };
  ImageFormat: { PNG: number; JPEG: number };
}

interface SkCanvas {
  drawImage(image: unknown, x: number, y: number): void;
  drawRect(
    rect: { x: number; y: number; width: number; height: number },
    paint: SkPaint
  ): void;
  drawPath(path: SkPath, paint: SkPaint): void;
  clipPath(path: SkPath, op: number, antiAlias: boolean): void;
  save(): void;
  restore(): void;
}

interface SkPath {
  transform(matrix: { scale(sx: number, sy: number): void }): void;
}

interface SkPaint {
  setColor(c: number): void;
  setStyle(style: number): void;
  setStrokeWidth(w: number): void;
  setAntiAlias(enabled: boolean): void;
}

function loadSkia(): SkiaModule {
  try {
    return require('@shopify/react-native-skia') as SkiaModule;
  } catch {
    throw new Error(MISSING_SKIA_MESSAGE);
  }
}

// CSS color keywords plus `transparent`. Not exhaustive against the
// full CSS level-4 list — covers everyday names consumers actually
// reach for. Uncommon keywords (`rebeccapurple`, `oldlace`) fall
// through to the stricter hex/rgb/hsl regex below.
const CSS_COLOR_KEYWORDS = new Set([
  'transparent',
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'cyan',
  'magenta',
  'gray',
  'grey',
  'orange',
  'purple',
  'pink',
  'brown',
]);

const CSS_COLOR_PATTERN = /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/;

function assertColor(value: string, context: string): string {
  if (CSS_COLOR_KEYWORDS.has(value.toLowerCase())) return value;
  if (CSS_COLOR_PATTERN.test(value)) return value;
  throw new Error(
    `${LOG_PREFIX} ${context} "${value}" is not a valid CSS color (expected 'transparent', a named color, #hex, rgb()/rgba(), or hsl()/hsla()).`
  );
}

function skiaColor(
  Skia: SkiaModule['Skia'],
  value: string,
  context: string
): number {
  return Skia.Color(assertColor(value, context));
}

export interface ApplyOutputMaskArgs {
  /**
   * URI of the rectangular crop. Always a local `file://` path emitted
   * by `ImageEditor.cropImage` — never a remote URL or consumer input,
   * so `Skia.Data.fromURI` below isn't a vector for arbitrary-URL
   * fetching.
   */
  sourceUri: string;
  /** SVG path string describing the shape in a 24×24 viewBox. */
  shapePath: string;
  /** Masking options from the consumer. */
  mask: OutputMask;
}

export interface MaskedOutput {
  /** `data:image/png;base64,...` — see `CropResult.uri` docs. */
  uri: string;
  width: number;
  height: number;
}

/**
 * Run the Skia mask composite. Throws a clear error if Skia isn't
 * installed, or if the image / path fails to decode. Callers wrap this
 * in their existing try/catch — the modal already surfaces failures via
 * `onError` and the footer.
 */
export async function applyOutputMask(
  args: ApplyOutputMaskArgs
): Promise<MaskedOutput> {
  const { sourceUri, shapePath, mask } = args;
  const { Skia, ClipOp, PaintStyle, ImageFormat } = loadSkia();

  const data = await Skia.Data.fromURI(sourceUri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    throw new Error('outputMask: failed to decode cropped image.');
  }
  const width = image.width();
  const height = image.height();

  const surface = Skia.Surface.Make(width, height);
  if (!surface) {
    throw new Error(
      `outputMask: failed to allocate ${width}×${height} Skia surface.`
    );
  }
  const canvas = surface.getCanvas();
  canvas.drawImage(image, 0, 0);

  const path = Skia.Path.MakeFromSVGString(shapePath);
  if (!path) {
    throw new Error('outputMask: failed to parse shape path.');
  }
  const matrix = Skia.Matrix();
  matrix.scale(width / 24, height / 24);
  path.transform(matrix);

  // Clip *out* the shape (ClipOp.Difference) then fill the remaining
  // region with the mask color. `save/restore` scopes the clip so the
  // optional stroke below runs against the unclipped canvas.
  const fillPaint = Skia.Paint();
  fillPaint.setColor(
    skiaColor(Skia, mask.color ?? 'transparent', 'outputMask.color')
  );
  fillPaint.setStyle(PaintStyle.Fill);
  fillPaint.setAntiAlias(true);
  canvas.save();
  canvas.clipPath(path, ClipOp.Difference, true);
  canvas.drawRect({ x: 0, y: 0, width, height }, fillPaint);
  canvas.restore();

  if (mask.stroke) {
    const strokePaint = Skia.Paint();
    strokePaint.setColor(
      skiaColor(Skia, mask.stroke.color, 'outputMask.stroke.color')
    );
    strokePaint.setStyle(PaintStyle.Stroke);
    strokePaint.setStrokeWidth(mask.stroke.width ?? 1);
    strokePaint.setAntiAlias(true);
    canvas.drawPath(path, strokePaint);
  }

  const snapshot = surface.makeImageSnapshot();
  const base64 = snapshot.encodeToBase64(ImageFormat.PNG);
  return {
    uri: `data:image/png;base64,${base64}`,
    width,
    height,
  };
}
