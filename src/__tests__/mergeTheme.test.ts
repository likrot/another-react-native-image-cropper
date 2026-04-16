import { defaultTheme } from '../constants/theme';
import { mergeTheme } from '../utils/mergeTheme';

describe('mergeTheme', () => {
  it('returns the base when partial is undefined', () => {
    expect(mergeTheme(defaultTheme)).toEqual(defaultTheme);
  });

  it('returns the base when partial is empty', () => {
    expect(mergeTheme(defaultTheme, {})).toEqual(defaultTheme);
  });

  it('does not mutate the base', () => {
    const before = JSON.parse(JSON.stringify(defaultTheme));
    mergeTheme(defaultTheme, {
      colors: { text: { light: '#ABCDEF' } },
    });
    expect(defaultTheme).toEqual(before);
  });

  it('overrides a deeply nested leaf without touching siblings', () => {
    const merged = mergeTheme(defaultTheme, {
      colors: { text: { light: '#ABCDEF' } },
    });
    expect(merged.colors.text.light).toBe('#ABCDEF');
    // Sibling tokens unchanged.
    expect(merged.colors.text.muted).toBe(defaultTheme.colors.text.muted);
    expect(merged.colors.status.error).toBe(defaultTheme.colors.status.error);
    expect(merged.spacing).toEqual(defaultTheme.spacing);
  });

  it('overrides multiple branches simultaneously', () => {
    const merged = mergeTheme(defaultTheme, {
      colors: { text: { light: '#000' } },
      spacing: { m: 20 },
    });
    expect(merged.colors.text.light).toBe('#000');
    expect(merged.spacing.m).toBe(20);
    expect(merged.spacing.xs).toBe(defaultTheme.spacing.xs);
  });

  it('overrides a primitive leaf at the top of a branch', () => {
    const merged = mergeTheme(defaultTheme, {
      colors: { handleActive: '#FF0000' },
    });
    expect(merged.colors.handleActive).toBe('#FF0000');
    expect(merged.colors.text).toEqual(defaultTheme.colors.text);
  });

  it('ignores undefined entries in the partial', () => {
    const merged = mergeTheme(defaultTheme, {
      colors: { handleActive: undefined },
    });
    expect(merged.colors.handleActive).toBe(defaultTheme.colors.handleActive);
  });
});
