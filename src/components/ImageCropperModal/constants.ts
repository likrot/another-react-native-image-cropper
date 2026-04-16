import type { CropMode } from '../../types';

export const DEFAULT_MODES: CropMode[] = ['pan-zoom', 'draw'];

/**
 * Extra px between the safe-area inset + `spacing.l` and the start of
 * the toolbar. Pulls the floating toolbar pill a hair off the system
 * status bar when it sits at the top.
 */
export const TOOLBAR_TOP_EXTRA_OFFSET = 5;

/**
 * Extra px reserved below the bottom-anchored toolbar so it sits
 * above the footer instruction/error pill instead of overlapping it.
 * Tuned to match the footer's intrinsic height at default spacing.
 */
export const TOOLBAR_BOTTOM_FOOTER_CLEARANCE = 28;
