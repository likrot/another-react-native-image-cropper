/**
 * Tiny icon renderer over `react-native-svg`. Each icon is a single SVG path
 * stored as a string in `src/constants/icons.ts` (sourced from Lucide, ISC).
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

import { ICON_PATHS, type IconName } from '../../constants/icons';

/**
 * Render-time parameters passed to consumer-supplied icon overrides. The
 * `icons` prop on `ImageCropperModal` can take either a ReactNode (static
 * override) or a function `(props: IconRenderProps) => ReactNode` that uses
 * these values.
 */
export interface IconRenderProps {
  size: number;
  color: string;
  /** Stroke width used for outlined icons. Filled icons ignore this. */
  strokeWidth?: number;
  /** Render the path as a filled shape instead of a stroke. */
  filled?: boolean;
}

interface IconProps extends IconRenderProps {
  name: IconName;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 22,
  color = '#FFFFFF',
  strokeWidth = 2,
  filled = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d={ICON_PATHS[name]}
      stroke={filled ? 'none' : color}
      strokeWidth={filled ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={filled ? color : 'none'}
    />
  </Svg>
);
