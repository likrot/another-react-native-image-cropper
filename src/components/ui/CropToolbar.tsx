/**
 * Compact toolbar for the crop modal.
 *
 * Portrait: horizontal centered bar at the top.
 * Landscape: vertical bar on the right edge.
 *
 * Layout: [close] | [mode picker — hidden when modes.length === 1] | [confirm]
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BAR_COLOR } from '../../constants/cropping';
import { type IconName } from '../../constants/icons';
import { defaultTheme, scale } from '../../constants/theme';
import { useIconRenderer } from '../../context/IconContext';
import { useTheme } from '../../context/ThemeContext';
import { ShapePicker, type Shape } from '../../shapes';
import type { CropMode } from '../../types';
import { IconPicker, type IconPickerItem } from './IconPicker';

const ICON_SIZE = scale(22);
const BUTTON_SIZE = scale(40);

const MODE_ICONS: Record<CropMode, IconName> = {
  'pan-zoom': 'move',
  'draw': 'square-dashed',
};

const DEFAULT_MODE_LABELS: Record<CropMode, string> = {
  'pan-zoom': 'Pan / zoom mode',
  'draw': 'Draw-to-crop mode',
};

interface CropToolbarProps {
  /** Active crop interaction mode. */
  mode: CropMode;
  /** Modes enabled for this session — drives whether the picker renders. */
  modes: CropMode[];
  /** Called when the user taps a mode toggle icon. */
  onModeChange: (mode: CropMode) => void;
  /** Active shape. Required when `shapes` has more than one entry. */
  shape?: Shape;
  /** Shapes enabled for this session — drives whether the shape picker renders. */
  shapes?: Shape[];
  /** Called when the user picks a different shape. */
  onShapeChange?: (shape: Shape) => void;
  /** Dismiss the modal without cropping. */
  onCancel: () => void;
  /** Trigger the native crop with the current selection. */
  onConfirm: () => void;
  /** Accessibility label for the cancel (close) icon. */
  cancelLabel: string;
  /** Accessibility label for the confirm (checkmark) icon. */
  confirmLabel: string;
  /** Disables all buttons (e.g. while cropping is in progress). */
  disabled?: boolean;
  /** Render vertically (for landscape orientation). */
  vertical?: boolean;
  /** Optional translated labels for the mode picker buttons. */
  modeLabels?: Partial<Record<CropMode, string>>;
}

export const CropToolbar: React.FC<CropToolbarProps> = ({
  mode,
  modes,
  onModeChange,
  shape,
  shapes,
  onShapeChange,
  onCancel,
  onConfirm,
  cancelLabel,
  confirmLabel,
  disabled,
  vertical,
  modeLabels,
}) => {
  const theme = useTheme();
  const renderIcon = useIconRenderer();
  const pickerItems = useMemo<IconPickerItem[]>(
    () =>
      modes.map((m) => ({
        id: m,
        icon: MODE_ICONS[m] as IconName,
        label: modeLabels?.[m] ?? DEFAULT_MODE_LABELS[m],
      })),
    [modes, modeLabels]
  );
  const showModePicker = modes.length > 1;
  const showShapePicker = !!(
    shapes &&
    shapes.length > 1 &&
    shape &&
    onShapeChange
  );
  const dividerStyle = useMemo(
    () => ({ backgroundColor: theme.colors.divider }),
    [theme.colors.divider]
  );

  return (
    <View style={[styles.bar, vertical && styles.barVertical]}>
      <TouchableOpacity
        onPress={onCancel}
        disabled={disabled}
        style={styles.button}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
      >
        {renderIcon('x', { size: ICON_SIZE, color: theme.colors.text.light })}
      </TouchableOpacity>

      {showModePicker && (
        <>
          <View
            style={[
              styles.divider,
              dividerStyle,
              vertical && styles.dividerVertical,
            ]}
          />
          <IconPicker
            items={pickerItems}
            value={mode}
            onChange={(id) => onModeChange(id as CropMode)}
            vertical={vertical}
            size={ICON_SIZE}
            disabled={disabled}
          />
        </>
      )}

      {showShapePicker && shape && onShapeChange && (
        <>
          {showModePicker ? (
            <Text
              style={[
                styles.pipeSeparator,
                vertical && styles.pipeSeparatorVertical,
                { color: theme.colors.text.muted },
              ]}
            >
              |
            </Text>
          ) : (
            <View
              style={[
                styles.divider,
                dividerStyle,
                vertical && styles.dividerVertical,
              ]}
            />
          )}
          <ShapePicker
            shapes={shapes!}
            value={shape.id}
            onChange={onShapeChange}
            vertical={vertical}
            disabled={disabled}
          />
        </>
      )}

      {(showModePicker || showShapePicker) && (
        <View
          style={[
            styles.divider,
            dividerStyle,
            vertical && styles.dividerVertical,
          ]}
        />
      )}

      <TouchableOpacity
        onPress={onConfirm}
        disabled={disabled}
        style={styles.button}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={confirmLabel}
      >
        {renderIcon('check', {
          size: ICON_SIZE,
          color: theme.colors.text.light,
        })}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BAR_COLOR,
    borderRadius: BUTTON_SIZE / 2,
    paddingHorizontal: defaultTheme.spacing.xs,
  },
  barVertical: {
    flexDirection: 'column',
    paddingHorizontal: 0,
    paddingVertical: defaultTheme.spacing.xs,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: BUTTON_SIZE * 0.5,
    marginHorizontal: defaultTheme.spacing.xs,
  },
  dividerVertical: {
    width: BUTTON_SIZE * 0.5,
    height: 1,
    marginHorizontal: 0,
    marginVertical: defaultTheme.spacing.xs,
  },
  pipeSeparator: {
    fontSize: scale(18),
    fontWeight: '300',
    lineHeight: BUTTON_SIZE,
    marginHorizontal: defaultTheme.spacing.xs,
  },
  pipeSeparatorVertical: {
    transform: [{ rotate: '90deg' }],
    marginHorizontal: 0,
    marginVertical: defaultTheme.spacing.xs,
  },
});
