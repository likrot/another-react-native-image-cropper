/**
 * Post-crop shape-cutout composite via `@shopify/react-native-skia`.
 *
 * Produces a PNG trimmed to the shape's tight bounding box, alpha-
 * transparent outside the silhouette — distinct from `outputMask`
 * which keeps the full crop-rect size. Output is a base64 data URI
 * by default, or raw bytes via an optional consumer callback.
 *
 * Pipeline: decode rect crop → get shape path bounds → allocate
 * tight-bbox surface → fill color → clip+draw image → optional
 * stroke → encode.
 */

import type { OutputCutout } from '../types';
import { loadSkia, skiaColor } from './skiaShared';

const SHAPE_VIEWBOX = 24;

export interface ApplyOutputCutoutArgs {
  /** URI of the rectangular crop from `ImageEditor.cropImage`. Always a local `file://`. */
  sourceUri: string;
  /** SVG path string describing the shape in a 24×24 viewBox. */
  shapePath: string;
  /** Cutout options from the consumer. */
  cutout: OutputCutout;
}

export interface CutoutOutput {
  /** Either `data:image/png;base64,...` or whatever string the consumer's `onBytes` returned. */
  uri: string;
  width: number;
  height: number;
}

export async function applyOutputCutout(
  args: ApplyOutputCutoutArgs
): Promise<CutoutOutput> {
  const { sourceUri, shapePath, cutout } = args;
  const { Skia, ClipOp, PaintStyle, ImageFormat } = loadSkia('outputCutout');

  const data = await Skia.Data.fromURI(sourceUri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    throw new Error('outputCutout: failed to decode cropped image.');
  }
  const rectWidth = image.width();
  const rectHeight = image.height();

  const path = Skia.Path.MakeFromSVGString(shapePath);
  if (!path) {
    throw new Error('outputCutout: failed to parse shape path.');
  }

  // `getBounds` returns rect in the shape's 24-unit viewBox. Scale
  // into pixel space against the rect crop's actual dimensions so
  // we know how big to make the output surface.
  const rawBounds = path.getBounds();
  const scaleX = rectWidth / SHAPE_VIEWBOX;
  const scaleY = rectHeight / SHAPE_VIEWBOX;
  const tight = {
    x: rawBounds.x * scaleX,
    y: rawBounds.y * scaleY,
    width: rawBounds.width * scaleX,
    height: rawBounds.height * scaleY,
  };

  const padding = Math.max(0, cutout.padding ?? 0);
  const outW = Math.round(tight.width + 2 * padding);
  const outH = Math.round(tight.height + 2 * padding);

  // Degenerate paths (zero-area silhouettes) would land here with
  // outW/outH ≤ 0. `Skia.Surface.Make(0, 0)` returns null on some
  // backends and crashes the native runtime on others — reject
  // explicitly before we hit it.
  if (outW <= 0 || outH <= 0) {
    throw new Error(
      `outputCutout: shape path has zero-area bounds (tight bbox ${tight.width}×${tight.height}).`
    );
  }

  const surface = Skia.Surface.Make(outW, outH);
  if (!surface) {
    throw new Error(
      `outputCutout: failed to allocate ${outW}×${outH} Skia surface.`
    );
  }
  const canvas = surface.getCanvas();

  // Step 1: scale the path from 24-unit viewBox into rect-crop pixel
  // space. Origin is still at (tight.x, tight.y) within the rect.
  const scaleMatrix = Skia.Matrix();
  scaleMatrix.scale(scaleX, scaleY);
  path.transform(scaleMatrix);

  // Step 2: translate so the tight bbox sits at (padding, padding)
  // inside the output surface.
  const shiftMatrix = Skia.Matrix();
  shiftMatrix.translate(-tight.x + padding, -tight.y + padding);
  path.transform(shiftMatrix);

  // 1. Fill the whole surface with the cutout color (default transparent).
  const fillPaint = Skia.Paint();
  fillPaint.setColor(
    skiaColor(Skia, cutout.color ?? 'transparent', 'outputCutout.color')
  );
  fillPaint.setStyle(PaintStyle.Fill);
  fillPaint.setAntiAlias(true);
  canvas.drawRect({ x: 0, y: 0, width: outW, height: outH }, fillPaint);

  // 2. Clip to the translated shape and draw the image aligned so the
  //    tight-bbox region lands at (padding, padding) in the surface.
  canvas.save();
  canvas.clipPath(path, ClipOp.Intersect, true);
  canvas.drawImage(image, -tight.x + padding, -tight.y + padding);
  canvas.restore();

  // 3. Optional stroke on the silhouette — outside the clip scope.
  if (cutout.stroke) {
    const strokePaint = Skia.Paint();
    strokePaint.setColor(
      skiaColor(Skia, cutout.stroke.color, 'outputCutout.stroke.color')
    );
    strokePaint.setStyle(PaintStyle.Stroke);
    strokePaint.setStrokeWidth(cutout.stroke.width ?? 1);
    strokePaint.setAntiAlias(true);
    canvas.drawPath(path, strokePaint);
  }

  const snapshot = surface.makeImageSnapshot();

  if (cutout.onBytes) {
    const bytes = snapshot.encodeToBytes(ImageFormat.PNG);
    const uri = await cutout.onBytes(bytes, {
      width: outW,
      height: outH,
      format: 'png',
    });
    return { uri, width: outW, height: outH };
  }

  const base64 = snapshot.encodeToBase64(ImageFormat.PNG);
  return {
    uri: `data:image/png;base64,${base64}`,
    width: outW,
    height: outH,
  };
}
