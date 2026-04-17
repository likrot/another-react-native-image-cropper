/**
 * Post-crop shape-mask composite via `@shopify/react-native-skia`.
 *
 * Pipeline: decode image → redraw onto surface → clip out the shape
 * path and fill the remaining region with the mask color → optional
 * stroke on top → encode PNG → base64 data URI.
 *
 * Skia is loaded lazily; consumers that never set `outputMask` don't
 * need the peer installed. Missing peer surfaces a clear install-hint
 * through the modal's existing try/catch.
 */

import type { OutputMask } from '../types';
import { loadSkia, skiaColor } from './skiaShared';

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
  const { Skia, ClipOp, PaintStyle, ImageFormat } = loadSkia('outputMask');

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
