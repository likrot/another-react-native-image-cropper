/**
 * Shape-aware resize gesture for Pan-Zoom mode. Returns a composed
 * `Gesture.Simultaneous(pan, pinch)` that activates only when the
 * initial touch falls **outside** the shape silhouette (per the
 * `pointInShape` worklet); inside-silhouette touches fail the gesture
 * so the caller's `Gesture.Exclusive(fullArea, imageGesture)` can
 * route the touch through to the image detector.
 *
 * The hit test is dynamic: each touch reads `rectW.value` /
 * `rectH.value` fresh so the silhouette hit region scales with the
 * crop frame as the user resizes it. When `pointInShape` is
 * undefined (bbox-filling shapes) the gate falls back to a rect
 * test.
 *
 * Two iOS-specific wrinkles shape the implementation; see inline
 * comments on the pan and pinch gestures for why each is needed.
 */

import { useMemo } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

const IS_IOS = Platform.OS === 'ios';

interface UseFullAreaResizeGestureArgs {
  containerWidth: number;
  containerHeight: number;
  /** Live crop rect (container-space). Used to map touch → bbox-local. */
  rectX: SharedValue<number>;
  rectY: SharedValue<number>;
  rectW: SharedValue<number>;
  rectH: SharedValue<number>;
  /**
   * Worklet hit test in bbox-local coords. Omitted when the shape
   * fills its bbox (rectangle, square) — the gate falls back to a
   * rect-bounds test. See `Shape.pointInShape`.
   */
  pointInShape?: (x: number, y: number, w: number, h: number) => boolean;
  frameScale: SharedValue<number>;
  maxFrameWidth: number;
  maxFrameHeight: number;
  /** Lower bound for `frameScale`. Default `0.2`. */
  minScale?: number;
}

export const useFullAreaResizeGesture = ({
  containerWidth,
  containerHeight,
  rectX,
  rectY,
  rectW,
  rectH,
  pointInShape,
  frameScale,
  maxFrameWidth,
  maxFrameHeight,
  minScale = 0.2,
}: UseFullAreaResizeGestureArgs) => {
  const savedFrameScale = useSharedValue(1);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  // One-shot latch: `state.activate()` fires at most once per touch
  // sequence. Calling it a second time on an active iOS recognizer
  // routes UIKit state through BEGAN again and cancels the gesture
  // mid-drag. Reset in `onFinalize`, not `onTouchesDown` — the latter
  // fires again for every new pointer joining an active gesture.
  const panActivated = useSharedValue(false);

  return useMemo(() => {
    // Two-layer hit test: bbox first (fast reject, and the only test
    // for bbox-filling shapes), then the worklet if the caller
    // provided one. Runs on the UI thread from `onTouchesDown`.
    const isOutsideShape = (tx: number, ty: number): boolean => {
      'worklet';
      const lx = tx - rectX.value;
      const ly = ty - rectY.value;
      if (lx < 0 || lx > rectW.value || ly < 0 || ly > rectH.value) return true;
      if (!pointInShape) return false;
      return !pointInShape(lx, ly, rectW.value, rectH.value);
    };

    // Platform-branched pan activation.
    //
    // Android: `state.activate()` is a pure state transition, safe to
    // call from `onTouchesDown`.
    //
    // iOS: `state.activate()` force-sets `UIPanGestureRecognizer.state
    // = .began`, but UIKit's own `touchesBegan` plumbing hasn't reached
    // `.possible` yet when our `onTouchesDown` runs, so the forced
    // transition is silently dropped. We defer the activate to the
    // first `onTouchesMove`, latched so later moves don't re-fire it.
    //
    // `maxPointers(1)` prevents the pan from competing with the pinch
    // for `frameScale.value` during a 2-finger gesture on Android.
    const pan = Gesture.Pan()
      .maxPointers(1)
      .manualActivation(true)
      .onTouchesDown((e, state) => {
        'worklet';
        const t = e.changedTouches[0];
        if (!t) {
          state.fail();
          return;
        }
        if (!isOutsideShape(t.x, t.y)) {
          state.fail();
          return;
        }
        if (!IS_IOS) {
          state.activate();
          panActivated.value = true;
        }
      })
      .onTouchesMove((_, state) => {
        'worklet';
        if (panActivated.value) return;
        panActivated.value = true;
        state.activate();
      })
      .onStart((e) => {
        'worklet';
        // Snapshot the starting `frameScale` and touch origin. Both
        // are read on every `onUpdate`; capturing at start keeps the
        // resize delta consistent even if upstream values are
        // overwritten during the gesture.
        savedFrameScale.value = frameScale.value;
        touchStartX.value = e.x;
        touchStartY.value = e.y;
      })
      .onUpdate((e) => {
        'worklet';
        if (maxFrameWidth <= 0 || maxFrameHeight <= 0) return;
        // Radial-from-center resize: map the 2D finger translation
        // onto a 1D signed distance along the radial axis running
        // from the container centre through the starting touch, and
        // apply that as a delta to `frameScale`. The effect is
        // "pull outward = grow, pull inward = shrink" regardless of
        // which corner of the dim area the user grabbed.
        const cx = containerWidth / 2;
        const cy = containerHeight / 2;
        const rx = touchStartX.value - cx;
        const ry = touchStartY.value - cy;
        const rLen = Math.sqrt(rx * rx + ry * ry);
        // Touch started essentially on centre — radial axis is
        // undefined, skip this frame.
        if (rLen < 1) return;
        const ux = rx / rLen;
        const uy = ry / rLen;
        const projected = e.translationX * ux + e.translationY * uy;
        // Normalize by half the smaller frame dimension so a
        // full-radius drag maps to a ~1.0 scale delta regardless of
        // frame aspect.
        const norm = Math.min(maxFrameWidth, maxFrameHeight) / 2;
        const d = (projected * 2) / norm;
        frameScale.value = Math.max(
          minScale,
          Math.min(1, savedFrameScale.value + d)
        );
      })
      .onFinalize(() => {
        'worklet';
        panActivated.value = false;
      });

    // The **first** finger's location decides the full-area gesture's
    // intent: inside the silhouette → fail so the image gesture takes
    // over (via `Gesture.Exclusive`); outside → wait for the 2nd
    // finger before activating (pinch needs 2+ pointers).
    //
    // Failing the pinch on 1-finger-inside is load-bearing: the outer
    // `Gesture.Simultaneous(pan, pinch)` stays "pending" as long as
    // *any* child is pending, and `Exclusive` blocks the lower-priority
    // image gesture until the higher-priority one resolves. If we
    // leave the pinch pending on 1-finger touches, a single inside
    // touch can't pan the image — the user would have to place a
    // second finger to unblock the image gesture.
    //
    // On iOS a 1-finger `state.activate()` force-sets
    // `UIPinchGestureRecognizer.state = .began`; UIKit then delivers
    // `.changed` events with `event.scale ≈ 1`, and `onUpdate` writes
    // `savedFrameScale * 1` every frame — which fights the pan's
    // writes and cancels the resize. So we only activate on 2+ touches.
    const pinch = Gesture.Pinch()
      .manualActivation(true)
      .onTouchesDown((e, state) => {
        'worklet';
        const t = e.changedTouches[0] ?? e.allTouches[0];
        if (!t) {
          state.fail();
          return;
        }
        if (e.numberOfTouches < 2) {
          // First touch: fail immediately if inside the silhouette so
          // the image gesture can take over. Stay pending if outside —
          // the 2nd finger down-event re-checks and activates.
          if (!isOutsideShape(t.x, t.y)) state.fail();
          return;
        }
        if (isOutsideShape(t.x, t.y)) state.activate();
        else state.fail();
      })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    containerWidth,
    containerHeight,
    maxFrameWidth,
    maxFrameHeight,
    minScale,
    pointInShape,
  ]);
};
