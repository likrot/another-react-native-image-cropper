/**
 * Compact footer pill for the crop modal.
 *
 * Shows either an instruction hint or an error message inside a small
 * rounded pill with a semi-transparent background.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BAR_COLOR } from '../../constants/cropping';
import { defaultTheme } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

interface CropFooterProps {
  /** Instruction text shown when there's no error. */
  instructions: string;
  /** Error message — when set, replaces the instructions. */
  error: string | null;
}

export const CropFooter: React.FC<CropFooterProps> = ({
  instructions,
  error,
}) => {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.pill}>
        <Text
          style={[
            styles.text,
            {
              color: error
                ? theme.colors.status.error
                : theme.colors.text.light,
              fontSize: theme.typography.bodySmall.fontSize,
              lineHeight: theme.typography.bodySmall.lineHeight,
            },
          ]}
        >
          {error ?? instructions}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
  },
  pill: {
    backgroundColor: BAR_COLOR,
    borderRadius: defaultTheme.spacing.s,
    paddingHorizontal: defaultTheme.spacing.m,
    paddingVertical: defaultTheme.spacing.xs,
  },
  text: {
    textAlign: 'center',
  },
});
