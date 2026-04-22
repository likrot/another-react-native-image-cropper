/**
 * Shape-shaped dim overlay for the non-animated paths (free-aspect
 * static shape in Pan-Zoom, static configs with numeric frame coords).
 * A `<G transform>` scales the shape path from its native 24×24
 * viewBox into the frame rectangle; the dim rect uses the shape as a
 * cutout mask.
 *
 * Rendered only for non-rectangular shapes — rectangle and `fillsBbox`
 * shapes use the four-rectangle `AnimatedDimOverlay` / `StaticDimOverlay`
 * path, which is cheaper and visually identical. Animated shape-aware
 * dim (Pan-Zoom resizable, Draw mode) uses `ShapeCutoutLayer` instead.
 */

import React from 'react';
import Svg, { Defs, G, Mask, Path, Rect } from 'react-native-svg';

import { SHAPE_MASK_ID } from '../../constants/svgIds';
import type { Shape } from '../types';

const ROOT_STYLE = { position: 'absolute' as const, top: 0, left: 0 };

const PATH_VIEWBOX = 24;

interface ShapeMaskProps {
  shape: Shape;
  /** Crop-area dimensions — pins the outer Svg coordinate system. */
  containerWidth: number;
  containerHeight: number;
  frameLeft: number;
  frameTop: number;
  frameWidth: number;
  frameHeight: number;
  dimColor: string;
  borderColor: string;
  borderWidth: number;
}

const buildTransform = (props: ShapeMaskProps) => [
  { translateX: props.frameLeft },
  { translateY: props.frameTop },
  { scaleX: Math.max(0, props.frameWidth) / PATH_VIEWBOX },
  { scaleY: Math.max(0, props.frameHeight) / PATH_VIEWBOX },
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
  const transform = buildTransform(props);

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
        <Mask id={SHAPE_MASK_ID}>
          <Rect
            x="0"
            y="0"
            width={containerWidth}
            height={containerHeight}
            fill="white"
          />
          <G transform={transform}>{renderShape(shape, { fill: 'black' })}</G>
        </Mask>
      </Defs>
      <Rect
        x="0"
        y="0"
        width={containerWidth}
        height={containerHeight}
        fill={dimColor}
        mask={`url(#${SHAPE_MASK_ID})`}
      />
      {hasPath && (
        <G transform={transform}>
          {renderShape(shape, {
            stroke: borderColor,
            strokeWidth: borderWidth,
          })}
        </G>
      )}
    </Svg>
  );
};
