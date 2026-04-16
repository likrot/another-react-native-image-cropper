import type { CropRect } from '../../types';

/**
 * Imperative handle every crop mode exposes to its parent modal. The
 * modal drives confirmation by asking the active mode for a crop rect
 * and drives reset by calling `reset` when the modal re-opens with a
 * new image.
 */
export interface CropModeHandle {
  getCropRect: () => CropRect | null;
  reset: () => void;
}
