/**
 * Shared Skia module surface + helpers. Consumed by the `outputMask`
 * and `outputCutout` pipelines.
 *
 * The `SkiaModule` interface is a narrow projection — declaring it
 * locally (rather than importing types from `@shopify/react-native-skia`)
 * keeps the library buildable when the peer isn't installed at all.
 *
 * Verified against `@shopify/react-native-skia@2.6.x`. When bumping
 * the peer, re-check the method signatures below against the
 * release notes — RN-Skia's JS surface evolves with the Skia C++
 * releases it wraps.
 */

import { LOG_PREFIX } from '../constants/library';

export interface SkPaint {
  setColor(c: number): void;
  setStyle(style: number): void;
  setStrokeWidth(w: number): void;
  setAntiAlias(enabled: boolean): void;
}

export interface SkMatrix {
  scale(sx: number, sy: number): void;
  translate(tx: number, ty: number): void;
}

export interface SkPath {
  transform(matrix: SkMatrix): void;
  getBounds(): { x: number; y: number; width: number; height: number };
}

export interface SkCanvas {
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

export interface SkImageSnapshot {
  encodeToBase64(format: number, quality?: number): string;
  encodeToBytes(format: number, quality?: number): Uint8Array;
}

export interface SkiaModule {
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
        makeImageSnapshot(): SkImageSnapshot;
      } | null;
    };
    Path: {
      MakeFromSVGString(svg: string): SkPath | null;
    };
    Matrix(): SkMatrix;
    Paint(): SkPaint;
    Color(c: string): number;
  };
  ClipOp: { Difference: number; Intersect: number };
  PaintStyle: { Fill: number; Stroke: number };
  ImageFormat: { PNG: number; JPEG: number };
}

/** Load `@shopify/react-native-skia` lazily. Throws a clear install-hint error when the peer is missing. */
export function loadSkia(featureName: string): SkiaModule {
  try {
    return require('@shopify/react-native-skia') as SkiaModule;
  } catch {
    throw new Error(
      `${featureName} requires @shopify/react-native-skia. Install it as a peer dependency (and re-run \`pod install\` on iOS), or remove the ${featureName} prop.`
    );
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

export function skiaColor(
  Skia: SkiaModule['Skia'],
  value: string,
  context: string
): number {
  return Skia.Color(assertColor(value, context));
}
