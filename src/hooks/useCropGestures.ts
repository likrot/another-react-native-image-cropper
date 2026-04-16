/**
 * Pan + pinch gesture glue for the image cropper.
 *
 * Owns three shared values — `scale`, `translateX`, `translateY` — and
 * exposes them alongside a composed `Gesture.Simultaneous(pinch, pan)` and
 * a ready-to-use animated style. The caller puts the animated style on the
 * image wrapper and wraps the touch area in a `GestureDetector`.
 *
 * Clamp policy:
 *   - `scale` is clamped to `[1, MAX_ZOOM_MULTIPLIER]` during pinch. 1 is the
 *     resting size where the image exactly fits inside the frame (via baseScale).
 *   - Translation is clamped symmetrically around 0 by the current pan limit
 *     (which depends on `scale`, so we recompute it on every gesture end and
 *     spring back if the user has overshot).
 *
 * `savedScale` / `savedTx` / `savedTy` snapshot each shared value at gesture
 * start so subsequent updates accumulate from that baseline instead of the
 * live (already-updated) value — this is what lets a pan follow a pinch
 * without jumping.
 */

import { useCallback, useLayoutEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { MAX_ZOOM_MULTIPLIER, SNAP_SPRING_CONFIG } from '../constants/cropping';
import { computeBaseScale, computePanLimit } from '../utils/cropMath';
import type { Size } from '../types';

interface UseCropGesturesArgs {
  source: Size;
  frame: Size;
  /** Minimum number of pointers required for the pan gesture. Defaults to 1. */
  panMinPointers?: number;
}

/**
 * Worklet: if the current translation sits outside the valid pan range,
 * spring it back to the nearest boundary. Called from both `pinch` and
 * `pan` gesture `.onEnd()` handlers — zoom-out and rubber-band drag each
 * leave room for an overshoot that needs the same correction.
 */
const snapTranslationToBounds = (
  translateX: SharedValue<number>,
  translateY: SharedValue<number>,
  displayedWidth: number,
  displayedHeight: number,
  scale: number,
  frame: Size
) => {
  'worklet';
  const limitX = computePanLimit(displayedWidth * scale, frame.width);
  const limitY = computePanLimit(displayedHeight * scale, frame.height);
  if (translateX.value > limitX)
    translateX.value = withSpring(limitX, SNAP_SPRING_CONFIG);
  if (translateX.value < -limitX)
    translateX.value = withSpring(-limitX, SNAP_SPRING_CONFIG);
  if (translateY.value > limitY)
    translateY.value = withSpring(limitY, SNAP_SPRING_CONFIG);
  if (translateY.value < -limitY)
    translateY.value = withSpring(-limitY, SNAP_SPRING_CONFIG);
};

interface UseCropGesturesReturn {
  /** Current pinch scale in `[1, MAX_ZOOM_MULTIPLIER]`; 1 = frame-cover baseline. */
  scale: SharedValue<number>;
  /** Current pan translation along X, in container px, clamped to frame bounds. */
  translateX: SharedValue<number>;
  /** Current pan translation along Y, in container px, clamped to frame bounds. */
  translateY: SharedValue<number>;
  /** Composed `Gesture.Simultaneous(pinch, pan)` to hand to a `GestureDetector`. */
  gesture: ReturnType<typeof Gesture.Simultaneous>;
  /**
   * Individual pan / pinch gestures that the composed `gesture` is built
   * from. Exposed so external gesture detectors (e.g. Draw-mode's rect
   * move handle) can declare themselves simultaneous with *each* of
   * them — `simultaneousWithExternalGesture` doesn't accept the
   * composed form.
   */
  imagePan: ReturnType<typeof Gesture.Pan>;
  imagePinch: ReturnType<typeof Gesture.Pinch>;
  /** Animated style to apply to the image wrapper (`translate{X,Y}` + `scale`). */
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  /** Resting image width in container px (source width × `baseScale`). */
  displayedWidth: number;
  /** Resting image height in container px (source height × `baseScale`). */
  displayedHeight: number;
  /** Snap all transform state back to the identity transform. Stable reference. */
  reset: () => void;
}

export const useCropGestures = ({
  source,
  frame,
  panMinPointers = 1,
}: UseCropGesturesArgs): UseCropGesturesReturn => {
  const baseScale = useMemo(
    () => computeBaseScale(source, frame),
    [source, frame]
  );
  const displayedWidth = source.width * baseScale;
  const displayedHeight = source.height * baseScale;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const geometryKey = useMemo(
    () => `${baseScale}:${displayedWidth}:${displayedHeight}`,
    [baseScale, displayedWidth, displayedHeight]
  );
  // Reset transform state whenever geometry changes so the previous image's
  // pan/zoom doesn't leak into a new source.
  useLayoutEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
  }, [
    geometryKey,
    scale,
    savedScale,
    translateX,
    translateY,
    savedTx,
    savedTy,
  ]);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          'worklet';
          savedScale.value = scale.value;
        })
        .onUpdate((event) => {
          'worklet';
          const next = savedScale.value * event.scale;
          scale.value = Math.max(1, Math.min(next, MAX_ZOOM_MULTIPLIER));
        })
        .onEnd(() => {
          'worklet';
          // Zooming out may have pushed translation past the new pan limit.
          snapTranslationToBounds(
            translateX,
            translateY,
            displayedWidth,
            displayedHeight,
            scale.value,
            frame
          );
        }),
    [
      displayedWidth,
      displayedHeight,
      frame,
      scale,
      savedScale,
      translateX,
      translateY,
    ]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minPointers(panMinPointers)
        .onStart(() => {
          'worklet';
          savedTx.value = translateX.value;
          savedTy.value = translateY.value;
        })
        .onUpdate((event) => {
          'worklet';
          translateX.value = savedTx.value + event.translationX;
          translateY.value = savedTy.value + event.translationY;
        })
        .onEnd(() => {
          'worklet';
          snapTranslationToBounds(
            translateX,
            translateY,
            displayedWidth,
            displayedHeight,
            scale.value,
            frame
          );
        }),
    [
      displayedWidth,
      displayedHeight,
      frame,
      scale,
      translateX,
      translateY,
      savedTx,
      savedTy,
      panMinPointers,
    ]
  );

  const gesture = useMemo(() => Gesture.Simultaneous(pinch, pan), [pinch, pan]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const reset = useCallback(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
  }, [scale, savedScale, translateX, translateY, savedTx, savedTy]);

  return {
    scale,
    translateX,
    translateY,
    gesture,
    imagePan: pan,
    imagePinch: pinch,
    animatedStyle,
    displayedWidth,
    displayedHeight,
    reset,
  };
};
