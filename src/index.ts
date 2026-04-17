// Main component
export { ImageCropperModal } from './components/ImageCropperModal';

// Component prop types
export type {
  FooterRenderProps,
  ImageCropperLabels,
  ImageCropperModalProps,
  ToolbarRenderProps,
} from './components/ImageCropperModal';

// Domain types
export type {
  CropMode,
  CropResult,
  FrameStyle,
  HandleStyle,
  ImageCropperHandle,
  OutputCutout,
  OutputFormat,
  OutputMask,
  ToolbarPosition,
} from './types';

// Theme
export { defaultTheme, type Theme } from './constants/theme';

// Icon override types
export type { IconRenderProps } from './components/ui/Icon';
export type { IconName } from './constants/icons';
export type { IconOverride, IconOverrideMap } from './context/IconContext';

// Shapes
export {
  builtInShapes,
  circleShape,
  heartShape,
  rectangleShape,
  squareShape,
  starShape,
  type Shape,
} from './shapes';
