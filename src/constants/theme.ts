/**
 * Visual tokens used by the crop UI. Consumers override any subset via the
 * `theme` prop on `ImageCropperModal` — the value is deep-merged onto
 * `defaultTheme` via `mergeTheme` before publishing to internal components
 * through `ThemeContext`.
 *
 * The `Theme` interface uses broad types (string, number) so overrides can
 * be any color / size the consumer wants. The defaults below happen to be
 * specific values; they're read at runtime, not pinned at the type level.
 */

export interface Theme {
  colors: {
    text: {
      light: string;
      muted: string;
    };
    status: {
      error: string;
    };
    handleActive: string;
    divider: string;
    rectBorder: string;
  };
  spacing: {
    xs: number;
    s: number;
    m: number;
    l: number;
  };
  typography: {
    bodySmall: {
      fontSize: number;
      lineHeight: number;
    };
  };
}

export const defaultTheme: Theme = {
  colors: {
    text: { light: '#FFFFFF', muted: 'rgba(255, 255, 255, 0.5)' },
    status: { error: '#FF453A' },
    handleActive: 'rgba(255, 255, 255, 0.2)',
    divider: 'rgba(255, 255, 255, 0.2)',
    rectBorder: 'rgba(255, 255, 255, 0.7)',
  },
  spacing: { xs: 4, s: 8, m: 12, l: 16 },
  typography: {
    bodySmall: { fontSize: 13, lineHeight: 18 },
  },
};

/**
 * Size-token transform. Currently identity — kept as the single
 * indirection every UI dimension passes through so a future theme
 * can introduce DPI, accessibility, or per-consumer scaling by
 * replacing this function without touching call sites.
 */
export const scale = (n: number): number => n;
