/**
 * SVG path data for the icons used by the crop UI.
 *
 * All paths are sourced from Lucide (https://lucide.dev), licensed under ISC.
 * See the NOTICE file at the repo root for full attribution. Each path is
 * rendered inside a 24×24 viewBox by `<Icon>` so consumers can pick any size.
 */

export type IconName =
  | 'x'
  | 'check'
  | 'move'
  | 'square-dashed'
  | 'square'
  | 'rectangle'
  | 'circle'
  | 'heart'
  | 'star'
  | 'chevron-right';

export const ICON_PATHS: Record<IconName, string> = {
  // lucide.dev/icons/x — ISC
  'x': 'M18 6 6 18M6 6l12 12',
  // lucide.dev/icons/check — ISC
  'check': 'M20 6 9 17l-5-5',
  // lucide.dev/icons/move — ISC
  'move':
    'M12 2v20M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20',
  // lucide.dev/icons/square-dashed — ISC (4 dashed corners)
  'square-dashed':
    'M5 3a2 2 0 0 0-2 2M19 3a2 2 0 0 1 2 2M21 19a2 2 0 0 1-2 2M5 21a2 2 0 0 1-2-2M9 3h1M9 21h1M14 3h1M14 21h1M3 9v1M21 9v1M3 14v1M21 14v1',
  // lucide.dev/icons/square — ISC
  'square': 'M3 3h18v18H3z',
  // lucide.dev/icons/rectangle-vertical — ISC
  'rectangle':
    'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z',
  // lucide.dev/icons/circle — ISC
  'circle': 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20',
  // lucide.dev/icons/heart — ISC
  'heart':
    'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  // lucide.dev/icons/star — ISC
  'star':
    'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z',
  // lucide.dev/icons/chevron-right — ISC
  'chevron-right': 'm9 18 6-6-6-6',
};
