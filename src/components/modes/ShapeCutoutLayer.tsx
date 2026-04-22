/**
 * Shape-cutout dim overlay for curved silhouettes (circle / heart /
 * star / consumer shapes). Shared between Pan-Zoom and Draw modes.
 *
 * Renders the shape into a static-size `<Svg>` at `CANVAS_SIZE`, then
 * positions and scales it via a native `transform` on the outer
 * `Animated.View`. `renderToHardwareTextureAndroid` +
 * `shouldRasterizeIOS` cache the SVG as a hardware-layer bitmap, so
 * the PorterDuff mask composition runs once at mount and gesture
 * frames are just GPU matrix composites.
 *
 * Layers:
 *   1. Four `Animated.View` dim strips tiling outside the rect bbox.
 *   2. A cached `Animated.View` with the static mask + dim SVG.
 *   3. An uncached `Animated.View` with the border stroke. Its
 *      `strokeWidth` is animated to cancel the outer transform's
 *      scale (so displayed border stays ≈ `borderWidth` px), and
 *      quantized to 2-px rect steps so the native prop update only
 *      fires on threshold crossings.
 */

import React from 'react';
import { Platform } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg';

import { DIM_COLOR } from '../../constants/cropping';
import { SHAPE_CUTOUT_MASK_ID } from '../../constants/svgIds';
import type { Shape } from '../../shapes';

// Cached SVG canvas size in pixels. Large enough to keep reasonable
// fidelity when the rect is larger than the canvas; small enough that
// the one-time mask rasterization stays cheap.
const CANVAS_SIZE = 512;
const PATH_VIEWBOX = 24;

// Pixel alignment is platform-branched:
//
// - iOS honours sub-pixel layout, so fractional `rect{X,Y,W,H}` values
//   produce anti-aliased edges on the tiles and the cached layer that
//   don't line up — a visible hair-line between them. We snap all
//   coordinates to integer pixels via `Math.round` so both layer
//   types share the same pixel boundaries.
//
// - Android's native view system already rounds layout coordinates
//   internally and consistently across both layer types (plain Views
//   and hardware-textured Animated.Views), so the JS-side `Math.round`
//   is a no-op at best and an over-snap at worst (it can introduce a
//   rounding direction mismatch vs. what Android itself picks). Pass
//   the raw float values through and let Android's rasterizer snap
//   them uniformly.
//
// The ternary is inlined at each call site rather than extracted into
// a helper worklet — a module-level `'worklet'` helper function
// interacts badly with the plugin in this file (broke unrelated touch
// handling elsewhere in the modal during testing).
const IS_IOS = Platform.OS === 'ios';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props {
  shape: Shape;
  rectX: SharedValue<number>;
  rectY: SharedValue<number>;
  rectW: SharedValue<number>;
  rectH: SharedValue<number>;
  dimColor?: string;
  borderColor: string;
  borderWidth: number;
}

export const ShapeCutoutLayer: React.FC<Props> = ({
  shape,
  rectX,
  rectY,
  rectW,
  rectH,
  dimColor = DIM_COLOR,
  borderColor,
  borderWidth,
}) => {
  // All four dim tiles and the cached mask layer derive their pixel
  // boundaries from the **same** per-platform-snapped left / top /
  // right / bottom. Heights / widths are computed as a difference of
  // those processed edges (not e.g. `round(rectH)` independently), so
  // all layers share identical pixel boundaries regardless of how the
  // snap rounds.
  const dimTop = useAnimatedStyle(() => {
    const top = IS_IOS ? Math.round(rectY.value) : rectY.value;
    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: Math.max(0, top),
    };
  });
  const dimBottom = useAnimatedStyle(() => {
    const bottom = IS_IOS
      ? Math.round(rectY.value + rectH.value)
      : rectY.value + rectH.value;
    return {
      position: 'absolute' as const,
      top: bottom,
      left: 0,
      right: 0,
      bottom: 0,
    };
  });
  const dimLeft = useAnimatedStyle(() => {
    const top = IS_IOS ? Math.round(rectY.value) : rectY.value;
    const bottom = IS_IOS
      ? Math.round(rectY.value + rectH.value)
      : rectY.value + rectH.value;
    return {
      position: 'absolute' as const,
      top,
      left: 0,
      width: Math.max(0, IS_IOS ? Math.round(rectX.value) : rectX.value),
      height: Math.max(0, bottom - top),
    };
  });
  const dimRight = useAnimatedStyle(() => {
    const top = IS_IOS ? Math.round(rectY.value) : rectY.value;
    const bottom = IS_IOS
      ? Math.round(rectY.value + rectH.value)
      : rectY.value + rectH.value;
    return {
      position: 'absolute' as const,
      top,
      left: IS_IOS
        ? Math.round(rectX.value + rectW.value)
        : rectX.value + rectW.value,
      right: 0,
      height: Math.max(0, bottom - top),
    };
  });

  // Shared transform for the cached mask layer and the border layer.
  // `transformOrigin: '0 0'` so translate + scale compose predictably.
  // Edges are per-platform-snapped so the cached layer's effective
  // bounds match the dim tiles' bounds exactly (see `IS_IOS` comment
  // near the top of the file for the rounding rationale).
  const cutoutStyle = useAnimatedStyle(() => {
    const left = IS_IOS ? Math.round(rectX.value) : rectX.value;
    const top = IS_IOS ? Math.round(rectY.value) : rectY.value;
    const right = IS_IOS
      ? Math.round(rectX.value + rectW.value)
      : rectX.value + rectW.value;
    const bottom = IS_IOS
      ? Math.round(rectY.value + rectH.value)
      : rectY.value + rectH.value;
    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);
    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      transformOrigin: '0 0',
      transform: [
        { translateX: left },
        { translateY: top },
        { scaleX: w / CANVAS_SIZE },
        { scaleY: h / CANVAS_SIZE },
      ],
    };
  });

  // Animated stroke width that cancels the outer transform's scale
  // so the displayed border stays ≈ `borderWidth` px at every rect
  // size. `strokeWidth_vb = borderWidth · VIEWBOX / rectDim`. We use
  // `min(rectW, rectH)` so the stroke reads at least `borderWidth`
  // px on the narrower axis for non-1:1 shapes; for 1:1 built-ins
  // the two dimensions are equal. Quantized to 2-px rect steps so
  // Reanimated's prop diffing skips the native Path re-draw on
  // sub-threshold gesture moves.
  const borderAnimatedProps = useAnimatedProps(() => {
    'worklet';
    const minSide = Math.max(1, Math.min(rectW.value, rectH.value));
    const quantized = Math.max(1, Math.round(minSide / 2) * 2);
    return {
      strokeWidth: (borderWidth * PATH_VIEWBOX) / quantized,
    };
  });

  const hasPath = typeof shape.mask === 'string';
  const bg = { backgroundColor: dimColor };

  return (
    <>
      <Animated.View pointerEvents="none" style={[bg, dimTop]} />
      <Animated.View pointerEvents="none" style={[bg, dimBottom]} />
      <Animated.View pointerEvents="none" style={[bg, dimLeft]} />
      <Animated.View pointerEvents="none" style={[bg, dimRight]} />

      {/* Hardware-cached mask + dim layer. `key={shape.id}` forces a
          native-view remount when the active shape changes so the
          cached texture is re-rasterized with the new silhouette
          (otherwise the GPU layer can keep a stale bitmap of the
          previous shape). */}
      <Animated.View
        key={shape.id}
        pointerEvents="none"
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={cutoutStyle}
      >
        <Svg
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          viewBox={`0 0 ${PATH_VIEWBOX} ${PATH_VIEWBOX}`}
        >
          <Defs>
            <Mask id={SHAPE_CUTOUT_MASK_ID}>
              <Rect
                x="0"
                y="0"
                width={PATH_VIEWBOX}
                height={PATH_VIEWBOX}
                fill="white"
              />
              {typeof shape.mask === 'string' ? (
                <Path d={shape.mask} fill="black" />
              ) : (
                shape.mask(PATH_VIEWBOX)
              )}
            </Mask>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={PATH_VIEWBOX}
            height={PATH_VIEWBOX}
            fill={dimColor}
            mask={`url(#${SHAPE_CUTOUT_MASK_ID})`}
          />
        </Svg>
      </Animated.View>

      {/* Border layer — uncached so animated `strokeWidth` takes
          effect. Stroke-only path, no mask: per-frame cost is small. */}
      {hasPath && (
        <Animated.View pointerEvents="none" style={cutoutStyle}>
          <Svg
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            viewBox={`0 0 ${PATH_VIEWBOX} ${PATH_VIEWBOX}`}
          >
            <AnimatedPath
              d={shape.mask as string}
              fill="none"
              stroke={borderColor}
              animatedProps={borderAnimatedProps}
            />
          </Svg>
        </Animated.View>
      )}
    </>
  );
};
