import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DEFAULT_FRAME_PADDING,
  DEFAULT_MAX_OUTPUT_SIZE,
  OUTPUT_QUALITY,
} from '../../constants/cropping';
import { useTheme } from '../../context/ThemeContext';
import { useCropConfirm } from '../../hooks/useCropConfirm';
import { rectangleShape, type Shape } from '../../shapes';
import type { CropMode, ImageCropperHandle } from '../../types';
import { DrawMode } from '../modes/DrawMode';
import { PanZoomMode } from '../modes/PanZoomMode';
import type { CropModeHandle } from '../modes/types';
import { CropFooter } from '../ui/CropFooter';
import { CropToolbar } from '../ui/CropToolbar';
import { DEFAULT_MODES } from './constants';
import type { ImageCropperModalProps } from './types';
import { useToolbarLayout } from './useToolbarLayout';

/**
 * Pick the shape to show when the modal opens. `defaultShape` may be
 * either a `Shape` instance or an id string; unknown ids fall back to
 * the first entry of `shapes`.
 */
const resolveDefaultShape = (
  shapes: Shape[],
  defaultShape: Shape | string | undefined
): Shape => {
  const first = shapes[0] as Shape;
  if (defaultShape === undefined) return first;
  if (typeof defaultShape === 'string') {
    return shapes.find((s) => s.id === defaultShape) ?? first;
  }
  return defaultShape;
};

export const ModalContent = forwardRef<
  ImageCropperHandle,
  ImageCropperModalProps
>(
  (
    {
      visible,
      sourceUri,
      sourceWidth,
      sourceHeight,
      aspectRatio,
      framePadding = DEFAULT_FRAME_PADDING,
      modes = DEFAULT_MODES,
      defaultMode,
      onModeChange,
      shapes,
      defaultShape,
      onShapeChange,
      maxOutputSize = DEFAULT_MAX_OUTPUT_SIZE,
      outputQuality = OUTPUT_QUALITY,
      outputFormat = 'jpeg',
      outputMask,
      labels,
      onConfirm,
      onCancel,
      onError,
      toolbarPosition = 'auto',
      showFooter = true,
      frameStyle,
      handleStyle,
      debug,
      renderToolbar,
      renderFooter,
    },
    ref
  ) => {
    const theme = useTheme();
    const resolvedDefaultMode: CropMode = defaultMode ?? (modes[0] as CropMode);

    // Shape state. When `shapes` is not passed, no shape prop flows to
    // PanZoomMode → the plain 4-rectangle overlay path handles the
    // free-aspect rectangular crop (no SVG mask cost).
    const shapesProvided = shapes !== undefined && shapes.length > 0;
    const effectiveShapes = useMemo<Shape[]>(
      () => (shapesProvided ? shapes : [rectangleShape]),
      [shapes, shapesProvided]
    );
    const [shape, setShape] = useState<Shape>(() =>
      resolveDefaultShape(effectiveShapes, defaultShape)
    );
    const handleShapeChange = useCallback(
      (next: Shape) => {
        setShape(next);
        onShapeChange?.(next);
      },
      [onShapeChange]
    );

    // Effective aspect ratio for the frame / corner handles: the shape's
    // locked ratio wins over the `aspectRatio` prop when a shape has one.
    const effectiveAspectRatio: number | undefined =
      shape.aspectRatio ?? aspectRatio;
    const effectiveHandleAspect: number | null = shape.aspectRatio ?? null;
    const insets = useSafeAreaInsets();
    const { width: screenW, height: screenH } = useWindowDimensions();
    const isLandscape = screenW > screenH;

    const [containerSize, setContainerSize] = useState({
      width: 0,
      height: 0,
    });
    const [mode, setMode] = useState<CropMode>(resolvedDefaultMode);
    const handleModeChange = useCallback(
      (next: CropMode) => {
        setMode(next);
        onModeChange?.(next);
      },
      [onModeChange]
    );
    const modeRef = useRef<CropModeHandle>(null);

    // Drives toolbar/footer fade during corner drag (draw mode only).
    const isDragging = useSharedValue(0);
    const overlayOpacity = useAnimatedStyle(() => ({
      opacity: withTiming(isDragging.value === 1 ? 0 : 1, { duration: 200 }),
    }));

    const source = useMemo(
      () => ({ width: sourceWidth, height: sourceHeight }),
      [sourceWidth, sourceHeight]
    );

    const { confirm, cropping, error, clearError } = useCropConfirm({
      sourceUri,
      shape: shapesProvided ? shape : undefined,
      outputFormat,
      outputMask,
      outputQuality,
      maxOutputSize,
      onConfirm,
      onError,
      errorMessage: labels.errorMessage,
    });

    useEffect(() => {
      if (visible) {
        clearError();
        setMode(resolvedDefaultMode);
        setShape(resolveDefaultShape(effectiveShapes, defaultShape));
        modeRef.current?.reset();
      }
    }, [
      visible,
      sourceUri,
      resolvedDefaultMode,
      effectiveShapes,
      defaultShape,
      clearError,
    ]);

    const handleConfirm = useCallback(async () => {
      const rect = modeRef.current?.getCropRect();
      if (!rect) return;
      await confirm(rect);
    }, [confirm]);

    useImperativeHandle(
      ref,
      () => ({
        confirm: handleConfirm,
        cancel: onCancel,
        setMode: handleModeChange,
      }),
      [handleConfirm, onCancel, handleModeChange]
    );

    const hasGeometry = containerSize.width > 0 && containerSize.height > 0;

    const {
      layoutStyle: toolbarLayoutStyle,
      vertical: toolbarVertical,
      visible: toolbarVisible,
    } = useToolbarLayout({
      toolbarPosition,
      isLandscape,
      insets,
      spacing: theme.spacing,
    });

    return (
      <View style={styles.root}>
        <View
          testID="image-cropper-area"
          style={[styles.cropArea, { top: insets.top }]}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setContainerSize({ width, height });
          }}
        >
          {hasGeometry && mode === 'pan-zoom' && (
            <PanZoomMode
              ref={modeRef}
              sourceUri={sourceUri}
              source={source}
              containerSize={containerSize}
              aspectRatio={effectiveAspectRatio}
              framePadding={framePadding}
              shape={shapesProvided ? shape : undefined}
              frameStyle={frameStyle}
              debug={debug}
            />
          )}
          {hasGeometry && mode === 'draw' && (
            <DrawMode
              ref={modeRef}
              sourceUri={sourceUri}
              source={source}
              containerSize={containerSize}
              isDragging={isDragging}
              isLandscape={isLandscape}
              aspectRatio={effectiveHandleAspect}
              framePadding={framePadding}
              shape={shapesProvided ? shape : undefined}
              frameStyle={frameStyle}
              handleStyle={handleStyle}
              debug={debug}
              cropAreaTop={insets.top}
            />
          )}

          {cropping && (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={theme.colors.text.light} />
            </View>
          )}
        </View>

        {toolbarVisible && (
          <Animated.View
            pointerEvents="box-none"
            style={[toolbarLayoutStyle, overlayOpacity]}
          >
            {renderToolbar ? (
              renderToolbar({
                mode,
                modes,
                onModeChange: handleModeChange,
                shape,
                // Expose the consumer's own shapes only — do not leak the
                // synthesized `[rectangleShape]` fallback. Consumers who
                // check length to decide whether to render a shape picker
                // should see `0` when they didn't opt in.
                shapes: shapes ?? [],
                onShapeChange: handleShapeChange,
                onCancel,
                onConfirm: handleConfirm,
                labels,
                disabled: cropping || !hasGeometry,
                isLandscape,
              })
            ) : (
              <CropToolbar
                mode={mode}
                modes={modes}
                onModeChange={handleModeChange}
                shape={shapesProvided ? shape : undefined}
                shapes={shapesProvided ? effectiveShapes : undefined}
                onShapeChange={shapesProvided ? handleShapeChange : undefined}
                onCancel={onCancel}
                onConfirm={handleConfirm}
                cancelLabel={labels.cancel}
                confirmLabel={labels.confirm}
                disabled={cropping || !hasGeometry}
                vertical={toolbarVertical}
                modeLabels={labels.modes}
              />
            )}
          </Animated.View>
        )}

        {showFooter && (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.footerPosition,
              {
                bottom:
                  Math.max(insets.bottom, theme.spacing.s) + theme.spacing.s,
              },
              overlayOpacity,
            ]}
          >
            {renderFooter ? (
              renderFooter({ instructions: labels.instructions, error })
            ) : (
              <CropFooter instructions={labels.instructions} error={error} />
            )}
          </Animated.View>
        )}
      </View>
    );
  }
);
ModalContent.displayName = 'ModalContent';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  cropArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  footerPosition: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
});
