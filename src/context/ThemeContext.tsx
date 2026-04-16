/**
 * Theme propagation via React context. `ImageCropperModal` resolves the
 * effective theme (mergeTheme(defaultTheme, props.theme)) and publishes it
 * here. Internal components read via `useTheme()`.
 *
 * Context is used instead of prop-drilling so adding a new theme token
 * doesn't mean touching every component in the render tree.
 */

import React, { createContext, useContext, type ReactNode } from 'react';

import { defaultTheme, type Theme } from '../constants/theme';

const ThemeContext = createContext<Theme>(defaultTheme);

export interface ThemeProviderProps {
  value: Theme;
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  value,
  children,
}) => <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;

export const useTheme = (): Theme => useContext(ThemeContext);
