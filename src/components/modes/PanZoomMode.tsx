/**
 * Pan/zoom crop mode. Two sub-modes decided at render time:
 *
 * - **Static frame** (no shape or free-aspect shape): the frame fills
 *   the container; the user pans/pinches the image behind it.
 * - **Resizable frame** (aspect-locked shape): the four dim regions
 *   around the frame become gesture zones — pinch or pan outward to
 *   grow, inward to shrink. Zones never overlap the frame, so the
 *   image's own pan/pinch inside the frame is unaffected.
 */

import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
} from 'react';
import { Image, StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';

import { DIM_COLOR } from '../../constants/cropping';
import { useTheme } from '../../context/ThemeContext';
import { useCropGestures } from '../../hooks/useCropGestures';
import { ShapeMask, resolveFramePadding, type Shape } from '../../shapes';
import type { FrameStyle, Size } from '../../types';
import {
  centerRect,
  computeCropRect,
  computeCropRectFromRect,
  computeFrameSize,
} from '../../utils/cropMath';
import { StaticDimOverlay } from './DimOverlay';
import { PanZoomDimResizeZone } from './PanZoomDimResizeZone';
import type { CropModeHandle } from './types';

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
   * Active shape. When provided with a locked aspect ratio, the dim
   * overlay around the frame becomes four gesture zones — pinch or
   * pan outward to grow the mask, inward to shrink. When undefined or
   * free-aspect, the frame is static and fills the container.
   */
  shape?: Shape;
  /** Visual overrides for the frame border. */
  frameStyle?: FrameStyle;
  /**
   * Development hint — when `true`, each dim-area gesture zone renders
   * with a distinct tint so its hit region is visible. No effect on
   * production UX. Default `false`.
   */
  debug?: boolean;
}

// When `debug` is on, tint each gesture zone a different colour so the
// user can see where each one lives. Off in production — zones are
// transparent hit targets.
const DIM_ZONES = [
  { zone: 'top', debugColor: 'rgba(255, 80, 80, 0.35)' },
  { zone: 'right', debugColor: 'rgba(80, 200, 80, 0.35)' },
  { zone: 'bottom', debugColor: 'rgba(80, 140, 255, 0.35)' },
  { zone: 'left', debugColor: 'rgba(240, 220, 80, 0.35)' },
] as const;

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

    return (
      <>
        <GestureDetector gesture={gesture}>
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
        </GestureDetector>

        {isResizable && shape ? (
          <>
            <ShapeMask
              shape={shape}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
              rectX={rectX}
              rectY={rectY}
              rectW={rectW}
              rectH={rectH}
              dimColor={DIM_COLOR}
              borderColor={frameStyle?.borderColor ?? theme.colors.text.light}
              borderWidth={frameStyle?.borderWidth ?? 1}
            />
            {DIM_ZONES.map(({ zone, debugColor }) => (
              <PanZoomDimResizeZone
                key={zone}
                zone={zone}
                frameScale={frameScale}
                rectX={rectX}
                rectY={rectY}
                rectW={rectW}
                rectH={rectH}
                maxFrameWidth={maxFrame.width}
                maxFrameHeight={maxFrame.height}
                outlineInset={shape.outlineInset}
                debugColor={debug ? debugColor : undefined}
              />
            ))}
          </>
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
            borderWidth={frameStyle?.borderWidth ?? 1}
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
      </>
    );
  }
);

PanZoomMode.displayName = 'PanZoomMode';

const styles = StyleSheet.create({
  imageWrapper: {
    position: 'absolute',
  },
});
