import { LOG_PREFIX } from '../../constants/library';
import { DEFAULT_MODES } from './constants';
import type { ImageCropperModalProps } from './types';

/**
 * Programmer-error guard — throws on props that would otherwise
 * produce silently broken geometry or state. Runs once per render at
 * the top of `ImageCropperModal`.
 */
export const assertProps = (props: ImageCropperModalProps): void => {
  if (!props.sourceUri) {
    throw new Error(`${LOG_PREFIX} sourceUri is required`);
  }
  if (!(props.sourceWidth > 0)) {
    throw new Error(`${LOG_PREFIX} sourceWidth must be a positive number`);
  }
  if (!(props.sourceHeight > 0)) {
    throw new Error(`${LOG_PREFIX} sourceHeight must be a positive number`);
  }
  if (props.modes !== undefined && props.modes.length === 0) {
    throw new Error(`${LOG_PREFIX} modes must contain at least one entry`);
  }
  if (
    props.defaultMode !== undefined &&
    (props.modes ?? DEFAULT_MODES).indexOf(props.defaultMode) === -1
  ) {
    throw new Error(
      `${LOG_PREFIX} defaultMode "${props.defaultMode}" is not in modes`
    );
  }
  if (props.shapes !== undefined && props.shapes.length === 0) {
    throw new Error(`${LOG_PREFIX} shapes must contain at least one entry`);
  }
  if (props.shapes !== undefined && props.defaultShape !== undefined) {
    const id =
      typeof props.defaultShape === 'string'
        ? props.defaultShape
        : props.defaultShape.id;
    if (!props.shapes.some((s) => s.id === id)) {
      throw new Error(`${LOG_PREFIX} defaultShape "${id}" is not in shapes`);
    }
  }
  if (
    props.framePadding !== undefined &&
    (props.framePadding < 0 || props.framePadding >= 0.5)
  ) {
    throw new Error(
      `${LOG_PREFIX} framePadding must be in [0, 0.5) — got ${props.framePadding}`
    );
  }
};
