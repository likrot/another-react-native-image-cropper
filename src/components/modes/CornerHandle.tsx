/**
 * Draggable corner handle for draw-to-crop mode.
 *
 * Renders an L-bracket at a corner of the crop rectangle with a 56pt touch
 * target. Each handle is its own `GestureDetector` — RNGH routes touches via
 * native view targeting, so no `manualActivation` or hit-testing is needed.
 *
 * `dx`/`dy` encode the corner: (0,0)=TL, (1,0)=TR, (0,1)=BL, (1,1)=BR.
 * Each corner moves two edges while the opposite corner stays pinned.
 *
 * Image bounds are computed inline every frame from the image transform
 * shared values — no intermediate shared values.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { scale } from '../../constants/theme';
import type { HandleStyle } from '../../types';
import { computeImageBounds } from '../../utils/cropMath';
import { useTheme } from '../../context/ThemeContext';

const DEFAULT_ARM_LENGTH = scale(20);
const DEFAULT_ARM_THICKNESS = scale(3);
const DEFAULT_HIT_SIZE = scale(56);
/** Minimum rect size in container px. */
const MIN_RECT_SIZE = 32;

interface CornerHandleProps {
  /** 0 = left/top edge, 1 = right/bottom edge. */
  dx: number;
  dy: number;
  rectX: SharedValue<number>;
  rectY: SharedValue<number>;
  rectW: SharedValue<number>;
  rectH: SharedValue<number>;
  /** Image rest position + size (at scale=1, no pan). */
  imageLeft: number;
  imageTop: number;
  displayedWidth: number;
  displayedHeight: number;
  containerWidth: number;
  containerHeight: number;
  /** Image transform — read inline to compute live bounds. */
  imageScale: SharedValue<number>;
  imageTranslateX: SharedValue<number>;
  imageTranslateY: SharedValue<number>;
  /** Set to 1 on drag start, 0 on drag end — drives toolbar fade. */
  isDragging: SharedValue<number>;
  /**
   * Aspect ratio (w/h) to maintain while dragging. When set, the corner
   * resizes both dimensions proportionally. Null = free drag.
   */
  aspectRatio: number | null;
  /** Consumer-supplied style overrides. */
  handleStyle?: HandleStyle;
}

export const CornerHandle: React.FC<CornerHandleProps> = ({
  dx,
  dy,
  rectX,
  rectY,
  rectW,
  rectH,
  imageLeft: imgL,
  imageTop: imgT,
  displayedWidth: imgW,
  displayedHeight: imgH,
  containerWidth: cw,
  containerHeight: ch,
  imageScale,
  imageTranslateX,
  imageTranslateY,
  isDragging,
  aspectRatio,
  handleStyle: override,
}) => {
  const theme = useTheme();
  const ARM_LENGTH = override?.armLength ?? DEFAULT_ARM_LENGTH;
  const ARM_THICKNESS = override?.armThickness ?? DEFAULT_ARM_THICKNESS;
  const HIT_SIZE = override?.hitSize ?? DEFAULT_HIT_SIZE;
  const HIT_CENTER = HIT_SIZE / 2;
  const armColor = override?.color ?? theme.colors.text.light;

  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const savedW = useSharedValue(0);
  const savedH = useSharedValue(0);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          'worklet';
          isDragging.value = 1;
          savedX.value = rectX.value;
          savedY.value = rectY.value;
          savedW.value = rectW.value;
          savedH.value = rectH.value;
        })
        .onEnd(() => {
          'worklet';
          isDragging.value = 0;
        })
        .onUpdate((e) => {
          'worklet';
          const tx = e.translationX;
          const ty = e.translationY;

          const { minX, maxX, minY, maxY } = computeImageBounds({
            imageLeft: imgL,
            imageTop: imgT,
            displayedWidth: imgW,
            displayedHeight: imgH,
            containerWidth: cw,
            containerHeight: ch,
            scale: imageScale.value,
            translateX: imageTranslateX.value,
            translateY: imageTranslateY.value,
          });

          if (aspectRatio != null && aspectRatio > 0) {
            // Aspect-locked drag. Pick the primary axis (the one the user
            // moved further in ratio-normalized space), then derive the
            // other dimension from it so the rect keeps its shape.
            const widthDelta = dx === 0 ? -tx : tx;
            const heightDelta = dy === 0 ? -ty : ty;
            const widthFromHeight = heightDelta * aspectRatio;
            const primaryWidthDelta =
              Math.abs(widthDelta) > Math.abs(widthFromHeight)
                ? widthDelta
                : widthFromHeight;

            // Fit inside both the MIN_RECT_SIZE floor and the image-bounds
            // ceiling imposed on this corner.
            const anchorX =
              dx === 0 ? savedX.value + savedW.value : savedX.value;
            const anchorY =
              dy === 0 ? savedY.value + savedH.value : savedY.value;
            const maxW = dx === 0 ? anchorX - minX : maxX - savedX.value;
            const maxH = dy === 0 ? anchorY - minY : maxY - savedY.value;
            const maxWFromH = maxH * aspectRatio;
            const effectiveMaxW = Math.max(
              MIN_RECT_SIZE,
              Math.min(maxW, maxWFromH)
            );

            const desiredW = savedW.value + primaryWidthDelta;
            const newW = Math.max(
              MIN_RECT_SIZE,
              Math.min(desiredW, effectiveMaxW)
            );
            const newH = newW / aspectRatio;

            rectW.value = newW;
            rectH.value = newH;
            rectX.value = dx === 0 ? anchorX - newW : savedX.value;
            rectY.value = dy === 0 ? anchorY - newH : savedY.value;
            return;
          }

          // Free drag.
          if (dx === 0) {
            const newX = Math.max(
              minX,
              Math.min(
                savedX.value + tx,
                savedX.value + savedW.value - MIN_RECT_SIZE
              )
            );
            rectW.value = savedW.value + (savedX.value - newX);
            rectX.value = newX;
          } else {
            rectW.value = Math.max(
              MIN_RECT_SIZE,
              Math.min(savedW.value + tx, maxX - savedX.value)
            );
          }

          if (dy === 0) {
            const newY = Math.max(
              minY,
              Math.min(
                savedY.value + ty,
                savedY.value + savedH.value - MIN_RECT_SIZE
              )
            );
            rectH.value = savedH.value + (savedY.value - newY);
            rectY.value = newY;
          } else {
            rectH.value = Math.max(
              MIN_RECT_SIZE,
              Math.min(savedH.value + ty, maxY - savedY.value)
            );
          }
        })
        .maxPointers(1)
        .minDistance(0),
    // Geometry props only — shared values are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dx, dy, imgL, imgT, imgW, imgH, cw, ch, aspectRatio]
  );

  const wrapperStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: rectX.value + rectW.value * dx - HIT_SIZE / 2,
    top: rectY.value + rectH.value * dy - HIT_SIZE / 2,
    width: HIT_SIZE,
    height: HIT_SIZE,
  }));

  const hArmStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left:
        dx === 0
          ? HIT_CENTER - ARM_THICKNESS / 2
          : HIT_CENTER - ARM_LENGTH + ARM_THICKNESS / 2,
      top: HIT_CENTER - ARM_THICKNESS / 2,
      width: ARM_LENGTH,
      height: ARM_THICKNESS,
    }),
    [dx, ARM_LENGTH, ARM_THICKNESS, HIT_CENTER]
  );

  const vArmStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: HIT_CENTER - ARM_THICKNESS / 2,
      top:
        dy === 0
          ? HIT_CENTER - ARM_THICKNESS / 2
          : HIT_CENTER - ARM_LENGTH + ARM_THICKNESS / 2,
      width: ARM_THICKNESS,
      height: ARM_LENGTH,
    }),
    [dy, ARM_LENGTH, ARM_THICKNESS, HIT_CENTER]
  );

  const armColorStyle = useMemo(
    () => ({ backgroundColor: armColor }),
    [armColor]
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={wrapperStyle}>
        <View style={[armColorStyle, hArmStyle]} />
        <View style={[armColorStyle, vArmStyle]} />
      </Animated.View>
    </GestureDetector>
  );
};
