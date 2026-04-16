import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { DIM_COLOR } from '../../constants/cropping';
import type { FrameStyle } from '../../types';

interface BorderResolverArgs {
  frameStyle?: FrameStyle;
  defaultBorderColor: string;
}

const resolveBorder = ({
  frameStyle,
  defaultBorderColor,
}: BorderResolverArgs) => ({
  borderWidth: frameStyle?.borderWidth ?? 1,
  borderColor: frameStyle?.borderColor ?? defaultBorderColor,
  borderRadius: frameStyle?.borderRadius,
});

interface StaticDimOverlayProps extends BorderResolverArgs {
  frameTop: number;
  frameLeft: number;
  frameWidth: number;
  frameHeight: number;
}

/**
 * Four dim rectangles + frame border for a fixed crop frame.
 * Used when the frame position is a plain number (PanZoom's
 * free-aspect and static shape paths).
 */
export const StaticDimOverlay: React.FC<StaticDimOverlayProps> = ({
  frameTop,
  frameLeft,
  frameWidth,
  frameHeight,
  frameStyle,
  defaultBorderColor,
}) => {
  const border = resolveBorder({ frameStyle, defaultBorderColor });
  return (
    <>
      <View
        pointerEvents="none"
        style={[styles.dim, { top: 0, left: 0, right: 0, height: frameTop }]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.dim,
          { top: frameTop + frameHeight, left: 0, right: 0, bottom: 0 },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.dim,
          { top: frameTop, left: 0, width: frameLeft, height: frameHeight },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.dim,
          {
            top: frameTop,
            left: frameLeft + frameWidth,
            right: 0,
            height: frameHeight,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.frameBorder,
          {
            top: frameTop,
            left: frameLeft,
            width: frameWidth,
            height: frameHeight,
            ...border,
          },
        ]}
      />
    </>
  );
};

interface AnimatedDimOverlayProps extends BorderResolverArgs {
  rectX: SharedValue<number>;
  rectY: SharedValue<number>;
  rectW: SharedValue<number>;
  rectH: SharedValue<number>;
}

/**
 * Four dim rectangles + frame border driven by Reanimated shared
 * values so the overlay tracks the selection rect on the UI thread.
 * Used by DrawMode's plain-rectangle path.
 */
export const AnimatedDimOverlay: React.FC<AnimatedDimOverlayProps> = ({
  rectX,
  rectY,
  rectW,
  rectH,
  frameStyle,
  defaultBorderColor,
}) => {
  const border = resolveBorder({ frameStyle, defaultBorderColor });

  const dimTop = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: Math.max(0, rectY.value),
  }));
  const dimBottom = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: rectY.value + rectH.value,
    left: 0,
    right: 0,
    bottom: 0,
  }));
  const dimLeft = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: rectY.value,
    left: 0,
    width: Math.max(0, rectX.value),
    height: rectH.value,
  }));
  const dimRight = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: rectY.value,
    left: rectX.value + rectW.value,
    right: 0,
    height: rectH.value,
  }));
  const borderPosition = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: rectX.value,
    top: rectY.value,
    width: rectW.value,
    height: rectH.value,
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.dimBg, dimTop]} />
      <Animated.View pointerEvents="none" style={[styles.dimBg, dimBottom]} />
      <Animated.View pointerEvents="none" style={[styles.dimBg, dimLeft]} />
      <Animated.View pointerEvents="none" style={[styles.dimBg, dimRight]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.frameBorder, border, borderPosition]}
      />
    </>
  );
};

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    backgroundColor: DIM_COLOR,
  },
  dimBg: {
    backgroundColor: DIM_COLOR,
  },
  frameBorder: {
    position: 'absolute',
  },
});
