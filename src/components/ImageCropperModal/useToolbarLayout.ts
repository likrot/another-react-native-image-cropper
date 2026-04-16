import { useMemo } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { type Theme } from '../../constants/theme';
import type { ToolbarPosition } from '../../types';
import {
  TOOLBAR_BOTTOM_FOOTER_CLEARANCE,
  TOOLBAR_TOP_EXTRA_OFFSET,
} from './constants';

interface UseToolbarLayoutArgs {
  toolbarPosition: ToolbarPosition;
  isLandscape: boolean;
  insets: EdgeInsets;
  spacing: Theme['spacing'];
}

interface UseToolbarLayoutReturn {
  /** Positioning style for the floating toolbar container, or `null` when hidden. */
  layoutStyle: StyleProp<ViewStyle>;
  /** Whether the toolbar should render in its vertical orientation. */
  vertical: boolean;
  /** Whether to render the toolbar at all. */
  visible: boolean;
}

/**
 * Resolve the floating toolbar's absolute-position style and
 * orientation flags from `toolbarPosition` + device state.
 *
 * `'auto'` is the default: portrait → top-center horizontal,
 * landscape → right-edge vertical. All other values are explicit.
 * `'hidden'` yields `layoutStyle: null` and `visible: false`.
 */
export const useToolbarLayout = ({
  toolbarPosition,
  isLandscape,
  insets,
  spacing,
}: UseToolbarLayoutArgs): UseToolbarLayoutReturn => {
  const layoutStyle = useMemo<StyleProp<ViewStyle>>(() => {
    const resolved: ToolbarPosition =
      toolbarPosition === 'auto'
        ? isLandscape
          ? 'right'
          : 'top'
        : toolbarPosition;
    switch (resolved) {
      case 'top':
        return [
          styles.horizontal,
          { top: insets.top + spacing.l + TOOLBAR_TOP_EXTRA_OFFSET },
        ];
      case 'bottom':
        return [
          styles.horizontal,
          {
            bottom:
              Math.max(insets.bottom, spacing.s) +
              spacing.l +
              TOOLBAR_BOTTOM_FOOTER_CLEARANCE,
          },
        ];
      case 'left':
        return [
          styles.vertical,
          {
            left: insets.left + spacing.s,
            top: insets.top + spacing.s,
          },
        ];
      case 'right':
        return [
          styles.vertical,
          {
            right: insets.right + spacing.s,
            top: insets.top + spacing.s,
          },
        ];
      case 'hidden':
      default:
        return null;
    }
  }, [toolbarPosition, isLandscape, insets, spacing]);

  const vertical =
    toolbarPosition === 'left' ||
    toolbarPosition === 'right' ||
    (toolbarPosition === 'auto' && isLandscape);

  const visible = toolbarPosition !== 'hidden' && layoutStyle !== null;

  return { layoutStyle, vertical, visible };
};

const styles = StyleSheet.create({
  horizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  vertical: {
    position: 'absolute',
  },
});
