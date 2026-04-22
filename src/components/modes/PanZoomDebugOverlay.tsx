/**
 * Development visualization for Pan-Zoom's shape-aware resize hit
 * region. Driven by `PanZoomMode`'s `debug` prop.
 *
 * - `mode="tint"` — amber tint painted in the outside-silhouette
 *   region (where the resize gesture activates). Four static amber
 *   strips tile outside the `maxFrame` bbox; the silhouette cutout
 *   lives in a single `<Svg>` scoped to `maxFrame` dimensions.
 *
 * - `mode="grid"` — the tint plus a 15×15 grid inside the live frame
 *   bbox. Each point feeds `shape.pointInShape(...)` and renders as
 *   a dot in one of two batched `<Path>` elements (green = inside,
 *   red = outside). The grid snapshots the bbox into React state via
 *   a throttled `useAnimatedReaction` (≥2 px movement) so the dots
 *   update during resize without a per-frame re-render.
 *
 * `pointerEvents="none"` so the overlay never steals gestures.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, G, Mask, Path, Rect } from 'react-native-svg';

import { PAN_ZOOM_DEBUG_MASK_ID } from '../../constants/svgIds';
import type { Shape } from '../../shapes';

const PATH_VIEWBOX = 24;
const GRID_RESOLUTION = 15;
// Half-side of each grid marker in container pixels. 2 is the smallest
// size that still reads clearly on a typical phone screen.
const DOT_HALF = 2;

// Tint amber for "outside silhouette" (where resize activates).
const TINT_COLOR = 'rgba(255, 200, 80, 0.35)';
// Grid marker colors — saturated so they read on top of amber.
const INSIDE_COLOR = 'rgba(52, 211, 153, 0.9)'; // emerald
const OUTSIDE_COLOR = 'rgba(244, 63, 94, 0.9)'; // rose

const AnimatedG = Animated.createAnimatedComponent(G);

type Mode = 'tint' | 'grid';

interface Props {
  mode: Mode;
  shape: Shape;
  containerWidth: number;
  containerHeight: number;
  /** The maximum frame size (frameScale = 1). Svg renders at this size. */
  maxFrameWidth: number;
  maxFrameHeight: number;
  rectX: SharedValue<number>;
  rectY: SharedValue<number>;
  rectW: SharedValue<number>;
  rectH: SharedValue<number>;
}

const renderShape = (shape: Shape) => {
  if (typeof shape.mask === 'string') {
    return <Path d={shape.mask} fill="black" />;
  }
  return shape.mask(PATH_VIEWBOX);
};

/**
 * Build a single SVG path `d` string containing one small square per
 * sample point. Squares (via `M…h…v…h…Z`) render faster than circles
 * on Android and are visually indistinguishable at ~4 px. One path
 * per color — two native draw calls total vs. one per dot.
 */
const dotsToPath = (
  samples: { cx: number; cy: number }[],
  half: number
): string => {
  let d = '';
  const side = half * 2;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    d += `M${s.cx - half} ${s.cy - half}h${side}v${side}h${-side}Z`;
  }
  return d;
};

export const PanZoomDebugOverlay: React.FC<Props> = ({
  mode,
  shape,
  containerWidth,
  containerHeight,
  maxFrameWidth,
  maxFrameHeight,
  rectX,
  rectY,
  rectW,
  rectH,
}) => {
  const maxFrameLeft = (containerWidth - maxFrameWidth) / 2;
  const maxFrameTop = (containerHeight - maxFrameHeight) / 2;

  // Live transform for the amber tint's mask cutout, in maxFrame-local
  // coords (shape centered within the scoped Svg at current size).
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const w = Math.max(0, rectW.value);
    const h = Math.max(0, rectH.value);
    return {
      transform: [
        { translateX: (maxFrameWidth - w) / 2 },
        { translateY: (maxFrameHeight - h) / 2 },
        { scaleX: w / PATH_VIEWBOX },
        { scaleY: h / PATH_VIEWBOX },
      ],
    };
  });

  const wantGrid = mode === 'grid';

  // Mirror the live bbox into React state so the grid's
  // `pointInShape` samples run on the JS thread. Throttled to ≥2 px
  // movement to cap re-renders during drag.
  const [bbox, setBbox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  useAnimatedReaction(
    () => ({
      x: rectX.value,
      y: rectY.value,
      w: rectW.value,
      h: rectH.value,
    }),
    (current, prev) => {
      'worklet';
      if (!wantGrid) return;
      if (!prev) return;
      const moved =
        Math.abs(current.x - prev.x) >= 2 ||
        Math.abs(current.y - prev.y) >= 2 ||
        Math.abs(current.w - prev.w) >= 2 ||
        Math.abs(current.h - prev.h) >= 2;
      if (moved) runOnJS(setBbox)(current);
    }
  );
  useEffect(() => {
    if (!wantGrid) return;
    setBbox({
      x: rectX.value,
      y: rectY.value,
      w: rectW.value,
      h: rectH.value,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantGrid]);

  // Dot coordinates are maxFrame-local — the dots render inside
  // the maxFrame-scoped Svg.
  const { insidePath, outsidePath } = useMemo(() => {
    const hitTest = shape.pointInShape;
    if (!wantGrid || !hitTest || bbox.w <= 0 || bbox.h <= 0) {
      return { insidePath: '', outsidePath: '' };
    }
    const inside: { cx: number; cy: number }[] = [];
    const outside: { cx: number; cy: number }[] = [];
    const step = 1 / (GRID_RESOLUTION + 1);
    for (let ix = 1; ix <= GRID_RESOLUTION; ix++) {
      for (let iy = 1; iy <= GRID_RESOLUTION; iy++) {
        const lx = ix * step * bbox.w;
        const ly = iy * step * bbox.h;
        const sample = {
          cx: bbox.x - maxFrameLeft + lx,
          cy: bbox.y - maxFrameTop + ly,
        };
        if (hitTest(lx, ly, bbox.w, bbox.h)) inside.push(sample);
        else outside.push(sample);
      }
    }
    return {
      insidePath: dotsToPath(inside, DOT_HALF),
      outsidePath: dotsToPath(outside, DOT_HALF),
    };
  }, [
    wantGrid,
    shape,
    bbox.x,
    bbox.y,
    bbox.w,
    bbox.h,
    maxFrameLeft,
    maxFrameTop,
  ]);

  const hasSilhouette = typeof shape.mask === 'string';

  return (
    <>
      {/* Four static tint strips around the maxFrame area. */}
      <View
        pointerEvents="none"
        style={[
          styles.tint,
          { top: 0, left: 0, right: 0, height: maxFrameTop },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.tint,
          {
            top: maxFrameTop + maxFrameHeight,
            left: 0,
            right: 0,
            bottom: 0,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.tint,
          {
            top: maxFrameTop,
            left: 0,
            width: maxFrameLeft,
            height: maxFrameHeight,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.tint,
          {
            top: maxFrameTop,
            left: maxFrameLeft + maxFrameWidth,
            right: 0,
            height: maxFrameHeight,
          },
        ]}
      />

      {/* Animated tint+grid SVG scoped to the maxFrame area. */}
      <Svg
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: maxFrameTop,
          left: maxFrameLeft,
        }}
        width={maxFrameWidth}
        height={maxFrameHeight}
        viewBox={`0 0 ${maxFrameWidth} ${maxFrameHeight}`}
        preserveAspectRatio="none"
      >
        {hasSilhouette && (
          <Defs>
            <Mask id={PAN_ZOOM_DEBUG_MASK_ID}>
              <Rect
                x="0"
                y="0"
                width={maxFrameWidth}
                height={maxFrameHeight}
                fill="white"
              />
              <AnimatedG animatedProps={animatedProps}>
                {renderShape(shape)}
              </AnimatedG>
            </Mask>
          </Defs>
        )}
        {hasSilhouette && (
          <Rect
            x="0"
            y="0"
            width={maxFrameWidth}
            height={maxFrameHeight}
            fill={TINT_COLOR}
            mask={`url(#${PAN_ZOOM_DEBUG_MASK_ID})`}
          />
        )}
        {insidePath ? <Path d={insidePath} fill={INSIDE_COLOR} /> : null}
        {outsidePath ? <Path d={outsidePath} fill={OUTSIDE_COLOR} /> : null}
      </Svg>
    </>
  );
};

const styles = StyleSheet.create({
  tint: {
    position: 'absolute',
    backgroundColor: TINT_COLOR,
  },
});
