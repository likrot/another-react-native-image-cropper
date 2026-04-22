/**
 * Pan/zoom crop mode. Two sub-modes decided at render time:
 *
 * - **Static frame** (no shape or free-aspect shape): the frame fills
 *   the container; the user pans/pinches the image behind it.
 * - **Resizable frame** (aspect-locked shape): a single shape-aware
 *   gesture zone wraps the entire container. One-finger drag outside
 *   the silhouette (or pinch) resizes the crop (radial-from-center);
 *   inside the silhouette the image's own pan/pinch handles the touch.
 *
 * Hit testing runs through `shape.pointInShape(x, y, w, h)` — a
 * worklet the shape author provides (built-ins do; consumers can
 * too). Dynamic by construction: the hook reads the *live* frame
 * bbox on every touch so the hit region tracks the crop as the user
 * resizes it. Shapes that fill their bbox (rectangle, square) omit
 * the function and fall back to a bbox test.
 */

import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
} from 'react';
import { Image, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';

import { DIM_COLOR } from '../../constants/cropping';
import { useTheme } from '../../context/ThemeContext';
import { useCropGestures } from '../../hooks/useCropGestures';
import { useFullAreaResizeGesture } from '../../hooks/useFullAreaResizeGesture';
import { ShapeMask, resolveFramePadding, type Shape } from '../../shapes';
import type { FrameStyle, Size } from '../../types';
import {
  centerRect,
  computeCropRect,
  computeCropRectFromRect,
  computeFrameSize,
} from '../../utils/cropMath';
import { AnimatedDimOverlay, StaticDimOverlay } from './DimOverlay';
import { ShapeCutoutLayer } from './ShapeCutoutLayer';
import type { CropModeHandle } from './types';

// Dev-only debug overlay. `__DEV__` is a Metro-provided compile-time
// constant; in release bundles it's replaced with `false` and the
// whole branch (including the `require`) is dead-code-eliminated, so
// the overlay module never ships in production. `typeof import(...)`
// is purely type-level — no runtime import — so TS prop types survive.
type DebugOverlay = typeof import('./PanZoomDebugOverlay').PanZoomDebugOverlay;
const PanZoomDebugOverlay: DebugOverlay | undefined = __DEV__
  ? require('./PanZoomDebugOverlay').PanZoomDebugOverlay
  : undefined;

export interface PanZoomModeProps {
  sourceUri: string;
  source: Size;
  containerSize: Size;
  /** Frame aspect (width / height). Omit for a free-aspect frame that fills the container. */
  aspectRatio?: number;
  /**
   * Fraction of the container reserved as margin on each side of the
   * frame when `aspectRatio` is set. `0` = edge-to-edge. Defaults to
   * `0.06`. Free-aspect (no aspectRatio) ignores this — still fills.
   */
  framePadding?: number;
  /**
   * Active shape. When provided with a locked aspect ratio, a single
   * shape-aware gesture zone wraps the shape's silhouette — one-finger
   * drag outside the shape (or pinch) resizes the crop frame; inside
   * the shape the image pans/pinches normally. When undefined or
   * free-aspect, the frame is static and fills the container.
   */
  shape?: Shape;
  /** Visual overrides for the frame border. */
  frameStyle?: FrameStyle;
  /**
   * Development visualization of the shape-aware resize hit region.
   *
   * - `false` / omitted — off.
   * - `true` / `'tint'` — amber tint painted in the area outside the
   *   shape silhouette (where the resize gesture activates). One
   *   masked SVG `<Rect>`; cheap.
   * - `'grid'` — tint plus a 15×15 sample grid of dots driven by
   *   `shape.pointInShape(...)` (green = inside, red = outside),
   *   updating as the user resizes. Heavier — opt in when you
   *   actually need to debug the worklet's output.
   */
  debug?: boolean | 'tint' | 'grid';
}

export const PanZoomMode = forwardRef<CropModeHandle, PanZoomModeProps>(
  (
    {
      sourceUri,
      source,
      containerSize,
      aspectRatio,
      framePadding: framePaddingProp,
      shape,
      frameStyle,
      debug,
    },
    ref
  ) => {
    const theme = useTheme();
    const framePadding = resolveFramePadding(shape, framePaddingProp);

    // The aspect-locked "resizable" path is gated on having BOTH a shape
    // and a locked aspect ratio. Free-aspect shapes (null ratio) fall
    // through to the static path — resize without aspect = Draw mode.
    const isResizable =
      shape !== undefined && aspectRatio !== undefined && aspectRatio > 0;

    // Max possible frame (what frameScale=1 represents). For aspect-locked
    // shapes this is the largest rectangle that fits the container and
    // honors the ratio.
    const maxFrame = useMemo(
      () => computeFrameSize(containerSize, aspectRatio),
      [containerSize, aspectRatio]
    );

    // Static path uses the framePadding-inset container for its frame.
    // Resizable path uses maxFrame directly (margin is driven by the
    // initial frameScale instead).
    const staticFrame = useMemo(() => {
      if (isResizable) return maxFrame;
      if (aspectRatio && aspectRatio > 0) {
        const inset = {
          width: containerSize.width * (1 - 2 * framePadding),
          height: containerSize.height * (1 - 2 * framePadding),
        };
        return computeFrameSize(inset, aspectRatio);
      }
      return maxFrame;
    }, [isResizable, maxFrame, containerSize, aspectRatio, framePadding]);

    // Initial frame scale — matches the framePadding visual when the
    // component first mounts. User's corner drags modify it from there.
    const initialScale = isResizable ? 1 - 2 * framePadding : 1;
    const frameScale = useSharedValue(initialScale);
    // Reset scale when the container / aspect changes (new image opened).
    useLayoutEffect(() => {
      frameScale.value = initialScale;
    }, [
      containerSize.width,
      containerSize.height,
      aspectRatio,
      initialScale,
      frameScale,
    ]);

    // Image sizing uses the MAX frame so the image stays the same size
    // regardless of what the user does with the resize handles. Only the
    // frame/dim overlay changes size; the image is a stable backdrop.
    const {
      gesture,
      animatedStyle,
      scale,
      translateX,
      translateY,
      displayedWidth,
      displayedHeight,
      reset,
    } = useCropGestures({ source, frame: maxFrame });

    const imageTop = (containerSize.height - displayedHeight) / 2;
    const imageLeft = (containerSize.width - displayedWidth) / 2;

    // Derived rect shared values for the animated ShapeMask in
    // resizable mode. Plain JS derivations suffice since they read
    // one shared value and are consumed on the UI thread.
    const initialRect = centerRect(
      containerSize.width,
      containerSize.height,
      maxFrame.width * initialScale,
      maxFrame.height * initialScale
    );
    const rectX = useSharedValue(initialRect.x);
    const rectY = useSharedValue(initialRect.y);
    const rectW = useSharedValue(maxFrame.width * initialScale);
    const rectH = useSharedValue(maxFrame.height * initialScale);
    useAnimatedReaction(
      () => frameScale.value,
      (s) => {
        rectW.value = maxFrame.width * s;
        rectH.value = maxFrame.height * s;
        rectX.value = (containerSize.width - rectW.value) / 2;
        rectY.value = (containerSize.height - rectH.value) / 2;
      },
      [
        maxFrame.width,
        maxFrame.height,
        containerSize.width,
        containerSize.height,
      ]
    );

    const fullAreaGesture = useFullAreaResizeGesture({
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
      rectX,
      rectY,
      rectW,
      rectH,
      pointInShape: shape?.pointInShape,
      frameScale,
      maxFrameWidth: maxFrame.width,
      maxFrameHeight: maxFrame.height,
    });

    // `Gesture.Exclusive` (not `Race`): the image gesture is blocked
    // until fullArea either activates or fails. Inside-silhouette
    // touches trigger `state.fail()` in `fullArea.onTouchesDown`, so
    // the image takeover happens instantly. Race is insufficient on
    // iOS because `manualActivation` doesn't synchronously activate
    // the pan — it only unblocks it, and UIKit's dependency resolver
    // would then award the touch to the unblocked image pan.
    const composedGesture = useMemo(
      () =>
        isResizable ? Gesture.Exclusive(fullAreaGesture, gesture) : gesture,
      [isResizable, fullAreaGesture, gesture]
    );

    useImperativeHandle(
      ref,
      () => ({
        getCropRect: () => {
          if (isResizable) {
            const fW = maxFrame.width * frameScale.value;
            const fH = maxFrame.height * frameScale.value;
            if (!fW || !fH) return null;
            return computeCropRectFromRect({
              source,
              imageOriginX: imageLeft,
              imageOriginY: imageTop,
              displayedWidth,
              displayedHeight,
              rect: {
                x: (containerSize.width - fW) / 2,
                y: (containerSize.height - fH) / 2,
                w: fW,
                h: fH,
              },
              scale: scale.value,
              translateX: translateX.value,
              translateY: translateY.value,
            });
          }
          if (!staticFrame.width || !staticFrame.height) return null;
          return computeCropRect({
            source,
            frame: staticFrame,
            scale: scale.value,
            translateX: translateX.value,
            translateY: translateY.value,
          });
        },
        reset: () => {
          frameScale.value = initialScale;
          reset();
        },
      }),
      [
        isResizable,
        maxFrame,
        staticFrame,
        source,
        containerSize,
        imageLeft,
        imageTop,
        displayedWidth,
        displayedHeight,
        scale,
        translateX,
        translateY,
        frameScale,
        initialScale,
        reset,
      ]
    );

    const hasGeometry =
      maxFrame.width > 0 && maxFrame.height > 0 && displayedWidth > 0;
    if (!hasGeometry) return null;

    // Static-path frame geometry (used for the 4-rect overlay + frame border).
    const frameTop = (containerSize.height - staticFrame.height) / 2;
    const frameLeft = (containerSize.width - staticFrame.width) / 2;

    const imageView = (
      <Animated.View
        style={[
          styles.imageWrapper,
          {
            top: imageTop,
            left: imageLeft,
            width: displayedWidth,
            height: displayedHeight,
          },
          animatedStyle,
        ]}
      >
        <Image
          source={{ uri: sourceUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </Animated.View>
    );

    return (
      <>
        <GestureDetector gesture={composedGesture}>
          {isResizable && shape ? (
            <Animated.View
              testID="pan-zoom-full-area-resize"
              style={[
                styles.fullAreaWrapper,
                {
                  width: containerSize.width,
                  height: containerSize.height,
                },
              ]}
            >
              {imageView}
            </Animated.View>
          ) : (
            imageView
          )}
        </GestureDetector>

        {isResizable && shape && shape.fillsBbox ? (
          // Bbox-filling shapes: four `Animated.View` dim rects, no SVG.
          <AnimatedDimOverlay
            rectX={rectX}
            rectY={rectY}
            rectW={rectW}
            rectH={rectH}
            frameStyle={frameStyle}
            defaultBorderColor={theme.colors.text.light}
          />
        ) : isResizable && shape ? (
          // Curved silhouettes: hardware-cached static SVG transformed
          // to the current rect. Shared with Draw mode.
          <ShapeCutoutLayer
            shape={shape}
            rectX={rectX}
            rectY={rectY}
            rectW={rectW}
            rectH={rectH}
            dimColor={DIM_COLOR}
            borderColor={frameStyle?.borderColor ?? theme.colors.text.light}
            borderWidth={frameStyle?.borderWidth ?? 2}
          />
        ) : shape ? (
          <ShapeMask
            shape={shape}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            frameTop={frameTop}
            frameLeft={frameLeft}
            frameWidth={staticFrame.width}
            frameHeight={staticFrame.height}
            dimColor={DIM_COLOR}
            borderColor={frameStyle?.borderColor ?? theme.colors.text.light}
            borderWidth={frameStyle?.borderWidth ?? 2}
          />
        ) : (
          <StaticDimOverlay
            frameTop={frameTop}
            frameLeft={frameLeft}
            frameWidth={staticFrame.width}
            frameHeight={staticFrame.height}
            frameStyle={frameStyle}
            defaultBorderColor={theme.colors.text.light}
          />
        )}

        {__DEV__ && PanZoomDebugOverlay && debug && isResizable && shape ? (
          <PanZoomDebugOverlay
            mode={debug === 'grid' ? 'grid' : 'tint'}
            shape={shape}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            maxFrameWidth={maxFrame.width}
            maxFrameHeight={maxFrame.height}
            rectX={rectX}
            rectY={rectY}
            rectW={rectW}
            rectH={rectH}
          />
        ) : null}
      </>
    );
  }
);

PanZoomMode.displayName = 'PanZoomMode';

const styles = StyleSheet.create({
  imageWrapper: {
    position: 'absolute',
  },
  fullAreaWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
