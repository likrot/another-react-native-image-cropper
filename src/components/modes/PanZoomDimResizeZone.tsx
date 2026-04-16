/**
 * Dim-area resize zone for Pan-Zoom mode with an aspect-locked shape.
 *
 * One of four invisible hit targets that tile the dim overlay around
 * the shape's bounding rect (top / right / bottom / left). A
 * Pan + Pinch composite on the zone updates the shared `frameScale`:
 *
 *   - **Pinch** — `frameScale = savedScale * pinchScale`, clamped to
 *     `[minScale, 1]`. Works the same in every zone; the natural
 *     "two fingers spread = grow, pinch in = shrink" mental model.
 *   - **Pan** — the drag is projected onto the zone's outward axis.
 *     Top zone: drag up grows; bottom: down grows; left: left grows;
 *     right: right grows. "Drag outward = grow" holds regardless of
 *     where the user touched.
 *
 * The zones never overlap the shape's bbox, so the image view inside
 * the bbox keeps its own pan/pinch gestures with no composition needed.
 */

import React, { useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

type Zone = 'top' | 'right' | 'bottom' | 'left';

interface PanZoomDimResizeZoneProps {
  zone: Zone;
  /** Live frame scale (0..1 fraction of max). Shared across all zones. */
  frameScale: SharedValue<number>;
  /** Animated bbox geometry — the zone tracks one of its sides. */
  rectX: SharedValue<number>;
  rectY: SharedValue<number>;
  rectW: SharedValue<number>;
  rectH: SharedValue<number>;
  /** Frame dims when `frameScale.value === 1`. Normalises pan math. */
  maxFrameWidth: number;
  maxFrameHeight: number;
  /** Lower bound for `frameScale`. Default 0.2. */
  minScale?: number;
  /**
   * Inward offset from the bbox edge, as a fraction of the bbox.
   * `0` = zone starts at the bbox edge (correct for shapes that fill
   * their bbox, e.g. square). `0.1` = zone's inner edge is pulled 10%
   * into the bbox (curved shapes with empty corners: circle). When the
   * silhouette is asymmetric (heart's vertical slack > horizontal),
   * pass `{ x, y }` so each axis is insetted independently.
   */
  outlineInset?: number | { x: number; y: number };
  /** Debug tint rendered on the zone. Remove once the UX is signed off. */
  debugColor?: string;
}

const ZONE_SIGNS: Record<Zone, { xSign: number; ySign: number }> = {
  top: { xSign: 0, ySign: -1 },
  bottom: { xSign: 0, ySign: 1 },
  left: { xSign: -1, ySign: 0 },
  right: { xSign: 1, ySign: 0 },
};

export const PanZoomDimResizeZone: React.FC<PanZoomDimResizeZoneProps> = ({
  zone,
  frameScale,
  rectX,
  rectY,
  rectW,
  rectH,
  maxFrameWidth,
  maxFrameHeight,
  minScale = 0.2,
  outlineInset = 0,
  debugColor,
}) => {
  const savedFrameScale = useSharedValue(1);
  const { xSign, ySign } = ZONE_SIGNS[zone];
  const insetFractionX =
    typeof outlineInset === 'number' ? outlineInset : outlineInset.x;
  const insetFractionY =
    typeof outlineInset === 'number' ? outlineInset : outlineInset.y;

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .onStart(() => {
        'worklet';
        savedFrameScale.value = frameScale.value;
      })
      .onUpdate((e) => {
        'worklet';
        if (maxFrameWidth <= 0 || maxFrameHeight <= 0) return;
        // Factor of 2: handle sits at the edge of a centered frame —
        // moving the edge by `d` changes the full dimension by `2 * d`.
        const d =
          (xSign * e.translationX * 2) / maxFrameWidth +
          (ySign * e.translationY * 2) / maxFrameHeight;
        frameScale.value = Math.max(
          minScale,
          Math.min(1, savedFrameScale.value + d)
        );
      })
      .maxPointers(1)
      .minDistance(0);

    const pinch = Gesture.Pinch()
      .onStart(() => {
        'worklet';
        savedFrameScale.value = frameScale.value;
      })
      .onUpdate((e) => {
        'worklet';
        frameScale.value = Math.max(
          minScale,
          Math.min(1, savedFrameScale.value * e.scale)
        );
      });

    return Gesture.Simultaneous(pan, pinch);
    // Shared values are stable refs; only sign/geometry need to rebuild the gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xSign, ySign, maxFrameWidth, maxFrameHeight, minScale]);

  // `outlineInset` pulls each zone's *inner* edge into the bbox by a
  // fraction of the bbox dim. Curved shapes (heart/circle/star) have
  // empty corners inside the bbox — claiming that space both makes the
  // zone bigger AND positions it visually closer to the shape outline.
  // Left/right still span only the bbox vertical extent (also insetted)
  // so top/bottom own the corners and the four zones tile without
  // overlapping.
  const animatedStyle = useAnimatedStyle(() => {
    const x = rectX.value;
    const y = rectY.value;
    const w = rectW.value;
    const h = rectH.value;
    const insetX = w * insetFractionX;
    const insetY = h * insetFractionY;
    switch (zone) {
      case 'top':
        return {
          position: 'absolute' as const,
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(0, y + insetY),
        };
      case 'bottom':
        return {
          position: 'absolute' as const,
          top: y + h - insetY,
          left: 0,
          right: 0,
          bottom: 0,
        };
      case 'left':
        return {
          position: 'absolute' as const,
          top: y + insetY,
          left: 0,
          width: Math.max(0, x + insetX),
          height: Math.max(0, h - 2 * insetY),
        };
      case 'right':
        return {
          position: 'absolute' as const,
          top: y + insetY,
          left: x + w - insetX,
          right: 0,
          height: Math.max(0, h - 2 * insetY),
        };
    }
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          animatedStyle,
          debugColor ? { backgroundColor: debugColor } : null,
        ]}
      />
    </GestureDetector>
  );
};
