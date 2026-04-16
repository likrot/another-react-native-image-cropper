/**
 * Thin wrapper around `IconPicker` that exposes a shape picker. Maps each
 * Shape onto an IconPicker item, using the shape's `id` as the icon name
 * (falling back to a neutral square icon when the shape's id isn't a
 * bundled icon name — e.g. consumer-registered shapes).
 *
 * Overflow behavior (active + chevron → expand) is inherited from
 * IconPicker so large shape sets collapse gracefully.
 */

import React, { useMemo } from 'react';

import { ICON_PATHS, type IconName } from '../../constants/icons';
import {
  IconPicker,
  type IconPickerItem,
} from '../../components/ui/IconPicker';
import type { Shape } from '../types';

interface ShapePickerProps {
  /** Shapes offered in the picker. */
  shapes: Shape[];
  /** Active shape's `id`. */
  value: string;
  /** Fires with the full Shape when the user picks a different one. */
  onChange: (shape: Shape) => void;
  /** Stack icons vertically (landscape toolbar). */
  vertical?: boolean;
  /** Disable all buttons (e.g. while cropping is in progress). */
  disabled?: boolean;
}

export const ShapePicker: React.FC<ShapePickerProps> = ({
  shapes,
  value,
  onChange,
  vertical,
  disabled,
}) => {
  const items = useMemo<IconPickerItem[]>(
    () =>
      shapes.map((shape) => {
        const bundled = (ICON_PATHS as Record<string, string | undefined>)[
          shape.id
        ];
        const icon: IconName = bundled ? (shape.id as IconName) : 'square';
        return {
          id: shape.id,
          icon,
          label: shape.label ?? shape.id,
        };
      }),
    [shapes]
  );

  return (
    <IconPicker
      items={items}
      value={value}
      onChange={(id) => {
        const next = shapes.find((s) => s.id === id);
        if (next) onChange(next);
      }}
      vertical={vertical}
      disabled={disabled}
    />
  );
};
