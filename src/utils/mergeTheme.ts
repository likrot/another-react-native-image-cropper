/**
 * Deep-merge a partial theme override onto the default theme. Object nodes
 * merge recursively; non-object leaves in the override replace the base.
 * Arrays and functions are replaced wholesale (not merged) — the crop theme
 * has neither, but the rule is safe.
 */

import type { Theme } from '../constants/theme';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  // Exclude class instances / exotic objects — only merge into plain objects.
  Object.getPrototypeOf(value) === Object.prototype;

export const mergeTheme = (
  base: Theme,
  partial?: DeepPartial<Theme>
): Theme => {
  if (!partial) return base;
  return mergeInto(
    base as unknown as Record<string, unknown>,
    partial as Record<string, unknown>
  ) as unknown as Theme;
};

const mergeInto = (
  base: Record<string, unknown>,
  partial: Record<string, unknown>
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(partial)) {
    const pv = partial[key];
    if (pv === undefined) continue;
    const bv = base[key];
    if (isPlainObject(bv) && isPlainObject(pv)) {
      out[key] = mergeInto(bv, pv);
    } else {
      out[key] = pv;
    }
  }
  return out;
};
