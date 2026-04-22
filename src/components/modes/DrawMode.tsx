/**
 * Draw-to-crop mode. The user drags a rectangle with corner handles;
 * two-finger pan/pinch moves the image beneath. All gesture math runs
 * on the UI thread via Reanimated shared values.
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
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { DIM_COLOR } from '../../constants/cropping';
import { defaultTheme } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useCropGestures } from '../../hooks/useCropGestures';
import { isShapedOverlay, resolveFramePadding, type Shape } from '../../shapes';
import type { FrameStyle, HandleStyle, Size } from '../../types';
import {
  centerRect,
  computeCropRectFromRect,
  computeFrameSize,
  computeImageBounds,
} from '../../utils/cropMath';
import { CornerHandle } from './CornerHandle';
import { AnimatedDimOverlay } from './DimOverlay';
import { ShapeCutoutLayer } from './ShapeCutoutLayer';
import type { CropModeHandle } from './types';

// Semi-transparent tint overlaid on the rect interior when `debug` is
// on — same alpha as the Pan-Zoom debug zones so the two modes read
// consistently. `pointerEvents="none"` ensures it's purely visual.
const DEBUG_MOVE_TINT = 'rgba(220, 120, 255, 0.35)';

const IMAGE_PADDING = defaultTheme.spacing.s;
const IMAGE_PADDING_TOP_PORTRAIT = defaultTheme.spacing.l;
const IMAGE_PADDING_BOTTOM_PORTRAIT = defaultTheme.spacing.s;
const IMAGE_PADDING_VERTICAL_LANDSCAPE = defaultTheme.spacing.l;

const CORNERS = [
  { key: 'tl', dx: 0, dy: 0 },
  { key: 'tr', dx: 1, dy: 0 },
  { key: 'bl', dx: 0, dy: 1 },
  { key: 'br', dx: 1, dy: 1 },
] as const;

export interface DrawModeProps {
  sourceUri: string;
  source: Size;
  /** Measured dimensions of the crop area viewport (from onLayout). */
  containerSize: Size;
  /** Set to 1 when a corner is being dragged, 0 otherwise. Drives toolbar fade. */
  isDragging: SharedValue<number>;
  /** Whether the device is in landscape orientation. */
  isLandscape: boolean;
  /** Override top padding (e.g. to leave room for toolbar). Defaults to orientation-based constant. */
  padTop?: number;
  /**
   * Locked aspect ratio (width / height) to enforce while dragging corners.
   * Null = free drag. Typically driven by the active shape's aspectRatio.
   */
  aspectRatio?: number | null;
  /**
   * Fraction of the image reserved as margin around the initial crop
   * rect for aspect-locked shapes. Shrinks the initial rect below the
   * max aspect-fit so there's always some room to drag it. `0` =
   * edge-to-edge (no initial movement room). Free-aspect rectangle
   * ignores this and still fills the image. Default `0.06`.
   */
  framePadding?: number;
  /**
   * Active shape. Curved silhouettes render via `ShapeCutoutLayer`
   * (SVG cutout tracking the rect). Bbox-filling shapes (rectangle,
   * square, or any `fillsBbox: true`) use the cheap four-rectangle
   * dim overlay.
   */
  shape?: Shape;
  /** Visual overrides for the selection rectangle border. */
  frameStyle?: FrameStyle;
  /** Visual overrides for the corner drag handles. */
  handleStyle?: HandleStyle;
  /**
   * Development hint — when truthy, the rect's interior move handle
   * renders with a translucent tint so its hit region is visible.
   * Mirrors the type on the modal's `debug` prop; the string variants
   * (`'tint'`, `'grid'`) are Pan-Zoom-specific but still count as "on"
   * here. No effect on production UX. Default `false`.
   */
  debug?: boolean | 'tint' | 'grid';
  /**
   * Screen-space Y offset of the crop area's top edge — the parent
   * modal's `insets.top`. Used by the move gesture to translate
   * gesture-handler's absolute touch coords into container coords for
   * the inside-rect filter, which has to work against the image
   * transform's zoom/pan.
   */
  cropAreaTop: number;
}

export const DrawMode = forwardRef<CropModeHandle, DrawModeProps>(
  (
    {
      sourceUri,
      source,
      containerSize,
      isDragging,
      isLandscape,
      padTop,
      aspectRatio = null,
      framePadding: framePaddingProp,
      shape,
      frameStyle,
      handleStyle,
      debug,
      cropAreaTop,
    },
    ref
  ) => {
    const framePadding = resolveFramePadding(shape, framePaddingProp);
    const theme = useTheme();
    const useShapeMask = isShapedOverlay(shape);
    const topPad =
      padTop ??
      (isLandscape
        ? IMAGE_PADDING_VERTICAL_LANDSCAPE
        : IMAGE_PADDING_TOP_PORTRAIT);
    const bottomPad = isLandscape
      ? IMAGE_PADDING_VERTICAL_LANDSCAPE
      : IMAGE_PADDING_BOTTOM_PORTRAIT;
    const imageFrame = useMemo<Size>(
      () => ({
        width: Math.max(0, containerSize.width - IMAGE_PADDING * 2),
        height: Math.max(0, containerSize.height - topPad - bottomPad),
      }),
      [containerSize.width, containerSize.height, topPad, bottomPad]
    );

    const {
      imagePan,
      imagePinch,
      animatedStyle: imageAnimatedStyle,
      scale: imageScale,
      translateX: imageTranslateX,
      translateY: imageTranslateY,
      displayedWidth,
      displayedHeight,
      reset: resetImage,
    } = useCropGestures({ source, frame: imageFrame, panMinPointers: 2 });

    const imageLeft = (containerSize.width - displayedWidth) / 2;
    const verticalSpace = containerSize.height - displayedHeight;
    const imageTop = topPad + (verticalSpace - topPad - bottomPad) / 2;

    // Initial rect. Free aspect → fills the image. Locked aspect →
    // largest aspect-matching rectangle that fits inside the image
    // **with `framePadding` subtracted on each side**, centered. The
    // padding guarantees there's movement room in both axes out of the
    // gate — without it a 1:1 shape on a landscape image would have
    // zero Y slack (rect height == image height) and the user couldn't
    // drag it vertically until they shrunk with the corner handles.
    // Clamp still uses the full image bounds, so the user can move
    // right up to the image edge once they've dragged.
    const initialRect = useMemo(() => {
      if (aspectRatio && aspectRatio > 0) {
        const padScale = 1 - 2 * framePadding;
        const fitted = computeFrameSize(
          {
            width: displayedWidth * padScale,
            height: displayedHeight * padScale,
          },
          aspectRatio
        );
        const offset = centerRect(
          displayedWidth,
          displayedHeight,
          fitted.width,
          fitted.height
        );
        return {
          x: imageLeft + offset.x,
          y: imageTop + offset.y,
          w: fitted.width,
          h: fitted.height,
        };
      }
      return {
        x: imageLeft,
        y: imageTop,
        w: displayedWidth,
        h: displayedHeight,
      };
    }, [
      aspectRatio,
      framePadding,
      imageLeft,
      imageTop,
      displayedWidth,
      displayedHeight,
    ]);

    const rectX = useSharedValue(initialRect.x);
    const rectY = useSharedValue(initialRect.y);
    const rectW = useSharedValue(initialRect.w);
    const rectH = useSharedValue(initialRect.h);

    const imgRestLeft = useSharedValue(imageLeft);
    const imgRestTop = useSharedValue(imageTop);
    const imgRestW = useSharedValue(displayedWidth);
    const imgRestH = useSharedValue(displayedHeight);
    const containerW = useSharedValue(containerSize.width);
    const containerH = useSharedValue(containerSize.height);

    // `aspectRatio` + `framePadding` are included so swapping shapes
    // (rectangle → heart, heart → square, etc. — potentially with
    // different per-shape padding) re-seeds the rect to the new aspect
    // and margin.
    const geometryKey = useMemo(
      () =>
        `${displayedWidth}:${displayedHeight}:${containerSize.width}:${containerSize.height}:${topPad}:${bottomPad}:${aspectRatio ?? 'free'}:${framePadding}`,
      [
        displayedWidth,
        displayedHeight,
        containerSize.width,
        containerSize.height,
        topPad,
        bottomPad,
        aspectRatio,
        framePadding,
      ]
    );
    useLayoutEffect(() => {
      rectX.value = initialRect.x;
      rectY.value = initialRect.y;
      rectW.value = initialRect.w;
      rectH.value = initialRect.h;
      imgRestLeft.value = imageLeft;
      imgRestTop.value = imageTop;
      imgRestW.value = displayedWidth;
      imgRestH.value = displayedHeight;
      containerW.value = containerSize.width;
      containerH.value = containerSize.height;
      // geometryKey encodes all geometry deps — shared values are stable refs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geometryKey]);

    const savedRectX = useSharedValue(0);
    const savedRectY = useSharedValue(0);
    const savedRectW = useSharedValue(0);
    const savedRectH = useSharedValue(0);
    const rectSaved = useSharedValue(false);

    // 1-finger move gesture. Lives on the image view's GestureDetector
    // alongside the image's own pan/pinch — composing everything on a
    // single detector is the RNGH-v2 pattern for "one surface, gestures
    // branched by finger count" (see
    // https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/gesture-composition).
    // `maxPointers(1)` keeps it exclusive to single-finger drags; the
    // image gestures (`minPointers(2)` pan + pinch) claim multi-touch.
    //
    // The Pan always activates on 1-finger starts, but `isMoveActive`
    // gates whether it actually translates — only when the touch
    // originated inside the rect. Outside the rect, the gesture no-ops
    // so the user can still 1-finger the dim area without the rect
    // jumping.
    const moveSavedX = useSharedValue(0);
    const moveSavedY = useSharedValue(0);
    const isMoveActive = useSharedValue(false);
    // Screen → container Y offset. Shared so the worklet can read it
    // without closing over a React prop that might go stale between
    // gesture-factory rebuilds.
    const cropAreaTopSV = useSharedValue(cropAreaTop);
    useLayoutEffect(() => {
      cropAreaTopSV.value = cropAreaTop;
    }, [cropAreaTop, cropAreaTopSV]);
    const movePan = useMemo(
      () =>
        Gesture.Pan()
          .onStart((e) => {
            'worklet';
            // Use absolute (screen) touch coords: the image view has a
            // zoom/pan transform, so `e.x`/`e.y` drift relative to the
            // container once the user has pinched in. Absolute coords
            // are transform-independent — convert them to container
            // coords by subtracting the cropArea's screen-space top.
            const containerX = e.absoluteX;
            const containerY = e.absoluteY - cropAreaTopSV.value;
            const inside =
              containerX >= rectX.value &&
              containerX <= rectX.value + rectW.value &&
              containerY >= rectY.value &&
              containerY <= rectY.value + rectH.value;
            isMoveActive.value = inside;
            if (!inside) return;
            moveSavedX.value = rectX.value;
            moveSavedY.value = rectY.value;
          })
          .onUpdate((e) => {
            'worklet';
            if (!isMoveActive.value) return;
            // Clamp to the image's *current* visible bounds (post-zoom),
            // not the rest bounds — otherwise a zoomed-in image would
            // trap the rect inside the smaller pre-zoom extent. Reuses
            // `computeImageBounds`, which intersects the transformed
            // image with the container.
            const { minX, maxX, minY, maxY } = computeImageBounds({
              imageLeft: imgRestLeft.value,
              imageTop: imgRestTop.value,
              displayedWidth: imgRestW.value,
              displayedHeight: imgRestH.value,
              containerWidth: containerW.value,
              containerHeight: containerH.value,
              scale: imageScale.value,
              translateX: imageTranslateX.value,
              translateY: imageTranslateY.value,
            });
            const maxMoveX = maxX - rectW.value;
            const maxMoveY = maxY - rectH.value;
            rectX.value = Math.max(
              minX,
              Math.min(maxMoveX, moveSavedX.value + e.translationX)
            );
            rectY.value = Math.max(
              minY,
              Math.min(maxMoveY, moveSavedY.value + e.translationY)
            );
          })
          .onEnd(() => {
            'worklet';
            isMoveActive.value = false;
          })
          .maxPointers(1),
      // Shared values are stable refs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    );

    const composedImageGesture = useMemo(
      () => Gesture.Simultaneous(imagePinch, imagePan, movePan),
      [imagePinch, imagePan, movePan]
    );

    // Clamp rect to follow image bounds during zoom/pan animation.
    // Saves the rect before shrinking and restores it once the spring settles.
    useAnimatedReaction(
      () => ({
        s: imageScale.value,
        tx: imageTranslateX.value,
        ty: imageTranslateY.value,
      }),
      ({ s, tx, ty }) => {
        const { minX, maxX, minY, maxY } = computeImageBounds({
          imageLeft: imgRestLeft.value,
          imageTop: imgRestTop.value,
          displayedWidth: imgRestW.value,
          displayedHeight: imgRestH.value,
          containerWidth: containerW.value,
          containerHeight: containerH.value,
          scale: s,
          translateX: tx,
          translateY: ty,
        });
        const boundsW = maxX - minX;
        const boundsH = maxY - minY;

        const needsShrinkW = rectW.value > boundsW;
        const needsShrinkH = rectH.value > boundsH;
        const needsShrink =
          needsShrinkW ||
          needsShrinkH ||
          rectX.value < minX ||
          rectY.value < minY ||
          rectX.value + rectW.value > maxX ||
          rectY.value + rectH.value > maxY;

        if (needsShrink && !rectSaved.value) {
          savedRectX.value = rectX.value;
          savedRectY.value = rectY.value;
          savedRectW.value = rectW.value;
          savedRectH.value = rectH.value;
          rectSaved.value = true;
        }

        if (needsShrink) {
          rectW.value = Math.min(rectW.value, boundsW);
          rectH.value = Math.min(rectH.value, boundsH);
          rectX.value = Math.max(
            minX,
            Math.min(rectX.value, maxX - rectW.value)
          );
          rectY.value = Math.max(
            minY,
            Math.min(rectY.value, maxY - rectH.value)
          );
        }

        // Spring settled — restore saved rect, clamped to final image bounds.
        const atRest =
          Math.abs(s - 1) < 0.02 && Math.abs(tx) < 1 && Math.abs(ty) < 1;
        if (atRest && rectSaved.value) {
          rectSaved.value = false;
          const restL = imgRestLeft.value;
          const restT = imgRestTop.value;
          const restW = imgRestW.value;
          const restH = imgRestH.value;
          rectW.value = Math.min(savedRectW.value, restW);
          rectH.value = Math.min(savedRectH.value, restH);
          rectX.value = Math.max(
            restL,
            Math.min(savedRectX.value, restL + restW - rectW.value)
          );
          rectY.value = Math.max(
            restT,
            Math.min(savedRectY.value, restT + restH - rectH.value)
          );
        }
      }
    );

    useImperativeHandle(
      ref,
      () => ({
        getCropRect: () => {
          if (!displayedWidth || !displayedHeight) return null;
          return computeCropRectFromRect({
            source,
            imageOriginX: imageLeft,
            imageOriginY: imageTop,
            displayedWidth,
            displayedHeight,
            rect: {
              x: rectX.value,
              y: rectY.value,
              w: rectW.value,
              h: rectH.value,
            },
            scale: imageScale.value,
            translateX: imageTranslateX.value,
            translateY: imageTranslateY.value,
          });
        },
        reset: () => {
          resetImage();
          rectX.value = initialRect.x;
          rectY.value = initialRect.y;
          rectW.value = initialRect.w;
          rectH.value = initialRect.h;
          imgRestLeft.value = imageLeft;
          imgRestTop.value = imageTop;
          imgRestW.value = displayedWidth;
          imgRestH.value = displayedHeight;
          containerW.value = containerSize.width;
          containerH.value = containerSize.height;
        },
      }),
      [
        source,
        containerSize,
        displayedWidth,
        displayedHeight,
        imageLeft,
        imageTop,
        initialRect,
        rectX,
        rectY,
        rectW,
        rectH,
        imgRestLeft,
        imgRestTop,
        imgRestW,
        imgRestH,
        containerW,
        containerH,
        imageScale,
        imageTranslateX,
        imageTranslateY,
        resetImage,
      ]
    );

    const rectBorderStyle = useAnimatedStyle(() => ({
      position: 'absolute' as const,
      left: rectX.value,
      top: rectY.value,
      width: rectW.value,
      height: rectH.value,
    }));

    if (displayedWidth <= 0 || displayedHeight <= 0) return null;

    return (
      <>
        <GestureDetector gesture={composedImageGesture}>
          <Animated.View
            style={[
              styles.imageWrapper,
              {
                top: imageTop,
                left: imageLeft,
                width: displayedWidth,
                height: displayedHeight,
              },
              imageAnimatedStyle,
            ]}
          >
            <Image
              source={{ uri: sourceUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </Animated.View>
        </GestureDetector>

        {useShapeMask && shape ? (
          <ShapeCutoutLayer
            shape={shape}
            rectX={rectX}
            rectY={rectY}
            rectW={rectW}
            rectH={rectH}
            dimColor={DIM_COLOR}
            borderColor={frameStyle?.borderColor ?? theme.colors.rectBorder}
            borderWidth={frameStyle?.borderWidth ?? 2}
          />
        ) : (
          <AnimatedDimOverlay
            rectX={rectX}
            rectY={rectY}
            rectW={rectW}
            rectH={rectH}
            frameStyle={frameStyle}
            defaultBorderColor={theme.colors.rectBorder}
          />
        )}

        {debug && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.debugMoveTint,
              { backgroundColor: DEBUG_MOVE_TINT },
              rectBorderStyle,
            ]}
          />
        )}

        {CORNERS.map(({ key, dx, dy }) => (
          <CornerHandle
            key={key}
            dx={dx}
            dy={dy}
            rectX={rectX}
            rectY={rectY}
            rectW={rectW}
            rectH={rectH}
            imageLeft={imageLeft}
            imageTop={imageTop}
            displayedWidth={displayedWidth}
            displayedHeight={displayedHeight}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            imageScale={imageScale}
            imageTranslateX={imageTranslateX}
            imageTranslateY={imageTranslateY}
            isDragging={isDragging}
            aspectRatio={aspectRatio}
            handleStyle={handleStyle}
          />
        ))}
      </>
    );
  }
);

DrawMode.displayName = 'DrawMode';

const styles = StyleSheet.create({
  imageWrapper: {
    position: 'absolute',
  },
  debugMoveTint: {
    position: 'absolute',
  },
});
