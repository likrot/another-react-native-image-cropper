/**
 * Compact single-select icon picker.
 *
 * Layout:
 *   - `items.length <= max` — render every item inline. No chevron,
 *     no popover.
 *   - `items.length > max` — render only the active item + a chevron
 *     inline; the remaining items live in an animated popover
 *     positioned **perpendicular to the toolbar axis**. A horizontal
 *     toolbar drops the popover below the picker; a vertical toolbar
 *     pushes it to the side. Chevron direction flips with the state so
 *     it always points toward the hidden-or-about-to-be-revealed items.
 *
 * Keeps the toolbar footprint constant — `active + chevron` — regardless
 * of how many options the consumer wires in. Feeds both mode switching
 * and shape selection from `CropToolbar`.
 */

import React, {
  isValidElement,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BAR_COLOR } from '../../constants/cropping';
import { type IconName } from '../../constants/icons';
import { defaultTheme, scale } from '../../constants/theme';
import { useIconRenderer } from '../../context/IconContext';
import { useTheme } from '../../context/ThemeContext';

export interface IconPickerItem {
  /** Stable id returned via `onChange`. */
  id: string;
  /** Either a bundled icon name or a fully-rendered ReactNode. */
  icon: IconName | ReactNode;
  /** Accessibility label for the button. */
  label: string;
}

export interface IconPickerProps {
  items: IconPickerItem[];
  value: string;
  onChange: (id: string) => void;
  /** Max items rendered inline. More than this → collapse to active + chevron. Default 2. */
  max?: number;
  /** Render vertically (for landscape toolbars). */
  vertical?: boolean;
  /** Icon size in px. Default matches the toolbar icon size. */
  size?: number;
  /** Disables all interactions (e.g. during crop). */
  disabled?: boolean;
}

const ICON_SIZE = scale(22);
const BUTTON_SIZE = scale(40);
const EXPAND_DURATION = 180;
const POPOVER_GAP = defaultTheme.spacing.xs;

export const IconPicker: React.FC<IconPickerProps> = ({
  items,
  value,
  onChange,
  max = 2,
  vertical,
  size = ICON_SIZE,
  disabled,
}) => {
  const theme = useTheme();
  const renderIcon = useIconRenderer();
  const needsOverflow = items.length > max;
  const [expanded, setExpanded] = useState(false);

  const nonActiveItems = useMemo(
    () => items.filter((item) => item.id !== value),
    [items, value]
  );
  const popoverAxisSize = nonActiveItems.length * BUTTON_SIZE;

  const renderItemIcon = (
    iconOrNode: IconName | ReactNode,
    iconSize: number,
    color: string
  ): ReactNode => {
    if (isValidElement(iconOrNode)) return iconOrNode;
    return renderIcon(iconOrNode as IconName, { size: iconSize, color });
  };

  // Drives both the popover reveal and the chevron rotation.
  // 0 = collapsed, 1 = expanded. Non-overflow layout ignores it.
  // useLayoutEffect rather than useEffect so the shared-value update lands
  // in the same commit as the React state change — no one-frame flash of
  // stale geometry when `expanded` toggles.
  const progress = useSharedValue(0);
  useLayoutEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: EXPAND_DURATION,
    });
  }, [expanded, progress]);

  // Horizontal toolbar: height grows 0 → full (popover opens downward).
  // Vertical toolbar: width grows 0 → full (popover opens sideways).
  const popoverStyle = useAnimatedStyle(() => {
    const axis = interpolate(progress.value, [0, 1], [0, popoverAxisSize]);
    return {
      width: vertical ? axis : BUTTON_SIZE,
      height: vertical ? BUTTON_SIZE : axis,
      opacity: progress.value,
    };
  });

  // Chevron always points toward the items that are *about to* be revealed
  // (collapsed) or toward the active button (expanded).
  //   Horizontal bar: collapsed = down, expanded = up.
  //   Vertical bar:   collapsed = left, expanded = right.
  // `chevron-right` is the base glyph (points right at 0°); base angle +
  // 0→180° swing drives the rest.
  const chevronStyle = useAnimatedStyle(() => {
    const base = vertical ? 180 : 90;
    const swing = interpolate(progress.value, [0, 1], [0, 180]);
    return {
      transform: [{ rotate: `${base + swing}deg` }],
    };
  });

  const renderButton = (item: IconPickerItem) => {
    const isActive = item.id === value;
    return (
      <TouchableOpacity
        onPress={() => {
          onChange(item.id);
          if (needsOverflow) setExpanded(false);
        }}
        disabled={disabled}
        style={[
          styles.button,
          isActive && { backgroundColor: theme.colors.handleActive },
        ]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: isActive, disabled: !!disabled }}
      >
        {renderItemIcon(
          item.icon,
          size,
          isActive ? theme.colors.text.light : theme.colors.text.muted
        )}
      </TouchableOpacity>
    );
  };

  // Non-overflow: render every item inline.
  if (!needsOverflow) {
    return (
      <View style={[styles.row, vertical && styles.rowVertical]}>
        {items.map((item) => (
          <View key={item.id}>{renderButton(item)}</View>
        ))}
      </View>
    );
  }

  const activeItem = items.find((item) => item.id === value);

  return (
    <View>
      <View style={[styles.row, vertical && styles.rowVertical]}>
        {activeItem && (
          <View key={activeItem.id}>{renderButton(activeItem)}</View>
        )}
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          disabled={disabled}
          style={styles.chevronButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? 'Collapse options' : 'Show more options'
          }
          accessibilityState={{ expanded, disabled: !!disabled }}
        >
          <Animated.View style={chevronStyle}>
            {renderIcon('chevron-right', {
              size: size - 4,
              color: theme.colors.text.light,
            })}
          </Animated.View>
        </TouchableOpacity>
      </View>
      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        style={[
          vertical ? styles.popoverVertical : styles.popoverHorizontal,
          popoverStyle,
        ]}
      >
        {nonActiveItems.map((item) => (
          <View key={item.id}>{renderButton(item)}</View>
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowVertical: {
    flexDirection: 'column',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Horizontal toolbar → popover sits below the picker, first item nearest.
  popoverHorizontal: {
    position: 'absolute',
    top: BUTTON_SIZE + POPOVER_GAP,
    left: 0,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: BAR_COLOR,
    borderRadius: BUTTON_SIZE / 2,
    overflow: 'hidden',
  },
  // Vertical toolbar → popover sits to the picker's left (toward the
  // image). `row-reverse` keeps the first non-active item nearest the
  // picker so items reveal outward as the strip grows.
  popoverVertical: {
    position: 'absolute',
    top: 0,
    right: BUTTON_SIZE + POPOVER_GAP,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: BAR_COLOR,
    borderRadius: BUTTON_SIZE / 2,
    overflow: 'hidden',
  },
});
