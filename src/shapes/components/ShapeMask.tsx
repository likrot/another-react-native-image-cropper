/**
 * Shape-shaped dim overlay. One outer `<Svg>` pinned to the container's
 * size and viewBox; a `<G transform>` translates + scales the shape
 * path from its native 24×24 viewBox into the frame rectangle.
 *
 * Two input shapes — numeric frame coords (static) or Reanimated
 * shared values (animated) — select between a plain `<G>` and an
 * animated one driven via `useAnimatedProps`. Animating a `<G
 * transform>` rather than nesting an `<Svg x y w h>` is intentional:
 * `useAnimatedProps` on a nested Svg's x/y/width/height doesn't apply
 * reliably on iOS, leaving the mask off-target.
 *
 * Rendered only for non-rectangular shapes — rectangle keeps the
 * 4-rect dim overlay, which is cheaper and visually identical.
 */

import React from 'react';
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, G, Mask, Path, Rect } from 'react-native-svg';

import type { Shape } from '../types';

const ROOT_STYLE = { position: 'absolute' as const, top: 0, left: 0 };

const MASK_ID = 'arnic-shape-mask';
const PATH_VIEWBOX = 24;

const AnimatedG = Animated.createAnimatedComponent(G);

interface BaseProps {
  shape: Shape;
  /** Crop-area dimensions — pins the outer Svg coordinate system. */
  containerWidth: number;
  containerHeight: number;
  dimColor: string;
  borderColor: string;
  borderWidth: number;
}

interface StaticCoords {
  frameLeft: number;
  frameTop: number;
  frameWidth: number;
  frameHeight: number;
}

interface AnimatedCoords {
  rectX: SharedValue<number>;
  rectY: SharedValue<number>;
  rectW: SharedValue<number>;
  rectH: SharedValue<number>;
}

type ShapeMaskProps = BaseProps & (StaticCoords | AnimatedCoords);

const staticTransform = (c: StaticCoords) => [
  { translateX: c.frameLeft },
  { translateY: c.frameTop },
  { scaleX: Math.max(0, c.frameWidth) / PATH_VIEWBOX },
  { scaleY: Math.max(0, c.frameHeight) / PATH_VIEWBOX },
];

const renderShape = (
  shape: Shape,
  props: { fill?: string; stroke?: string; strokeWidth?: number }
) => {
  if (typeof shape.mask === 'string') {
    return (
      <Path
        d={shape.mask}
        fill={props.fill ?? 'none'}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  return shape.mask(PATH_VIEWBOX);
};

const isAnimated = (
  props: ShapeMaskProps
): props is BaseProps & AnimatedCoords => 'rectX' in props;

export const ShapeMask: React.FC<ShapeMaskProps> = (props) => {
  const {
    shape,
    containerWidth,
    containerHeight,
    dimColor,
    borderColor,
    borderWidth,
  } = props;
  const hasPath = typeof shape.mask === 'string';

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    if (!('rectX' in props)) {
      return { transform: [] };
    }
    const c = props as AnimatedCoords;
    return {
      transform: [
        { translateX: c.rectX.value },
        { translateY: c.rectY.value },
        { scaleX: Math.max(0, c.rectW.value) / PATH_VIEWBOX },
        { scaleY: Math.max(0, c.rectH.value) / PATH_VIEWBOX },
      ],
    };
  });

  const animated = isAnimated(props);

  return (
    <Svg
      pointerEvents="none"
      style={ROOT_STYLE}
      width={containerWidth}
      height={containerHeight}
      viewBox={`0 0 ${containerWidth} ${containerHeight}`}
      preserveAspectRatio="none"
    >
      <Defs>
        <Mask id={MASK_ID}>
          <Rect
            x="0"
            y="0"
            width={containerWidth}
            height={containerHeight}
            fill="white"
          />
          {animated ? (
            <AnimatedG animatedProps={animatedProps}>
              {renderShape(shape, { fill: 'black' })}
            </AnimatedG>
          ) : (
            <G transform={staticTransform(props)}>
              {renderShape(shape, { fill: 'black' })}
            </G>
          )}
        </Mask>
      </Defs>
      <Rect
        x="0"
        y="0"
        width={containerWidth}
        height={containerHeight}
        fill={dimColor}
        mask={`url(#${MASK_ID})`}
      />
      {hasPath && animated && (
        <AnimatedG animatedProps={animatedProps}>
          {renderShape(shape, {
            stroke: borderColor,
            strokeWidth: borderWidth,
          })}
        </AnimatedG>
      )}
      {hasPath && !animated && (
        <G transform={staticTransform(props)}>
          {renderShape(shape, {
            stroke: borderColor,
            strokeWidth: borderWidth,
          })}
        </G>
      )}
    </Svg>
  );
};
