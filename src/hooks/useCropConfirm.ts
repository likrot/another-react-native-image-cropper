import ImageEditor from '@react-native-community/image-editor';
import { useCallback, useState } from 'react';

import { LOG_PREFIX } from '../constants/library';
import { isOutputMaskableShape, type Shape } from '../shapes';
import type {
  CropRect,
  CropResult,
  OutputCutout,
  OutputFormat,
  OutputMask,
} from '../types';
import { computeDisplaySize } from '../utils/cropMath';
import { applyOutputCutout } from '../utils/cutoutOutput';
import { applyOutputMask } from '../utils/maskOutput';

export interface UseCropConfirmArgs {
  /** Local file URI of the image being cropped. */
  sourceUri: string;
  /** Active shape, or `undefined` when consumer didn't opt into shapes. */
  shape: Shape | undefined;
  /** File format for the native rect crop. Forced to `'png'` when `outputMask` is set. */
  outputFormat: OutputFormat;
  /** Skia mask-composite options, or `undefined` to skip the post-process step. */
  outputMask: OutputMask | undefined;
  /** Skia cutout options (tight-bbox shaped PNG), or `undefined` to skip. Mutually exclusive with `outputMask`. */
  outputCutout: OutputCutout | undefined;
  /** JPEG quality in `[0, 1]`. Ignored for PNG. */
  outputQuality: number;
  /** Longest-edge cap on the cropped output, in pixels. */
  maxOutputSize: number;
  /** Fires with the final `CropResult` once the pipeline completes. */
  onConfirm: (result: CropResult) => void;
  /** Optional consumer hook invoked when the crop / mask composite rejects. */
  onError: ((error: unknown) => void) | undefined;
  /** Footer error copy — shown to the user when the native crop rejects. */
  errorMessage: string;
}

export interface UseCropConfirmReturn {
  /** Run the native crop pipeline, applying `outputMask` if configured. */
  confirm: (rect: CropRect) => Promise<void>;
  /** `true` while the native crop / mask composite is in flight. */
  cropping: boolean;
  /** Current error copy, or `null`. */
  error: string | null;
  /** Reset the error when the modal re-opens with a fresh source. */
  clearError: () => void;
}

/**
 * Orchestrates the confirmation pipeline: native rect crop via
 * `@react-native-community/image-editor`, then an optional Skia
 * post-process — either `outputMask` (full-rect mask) or
 * `outputCutout` (tight-bbox shape). Owns the `cropping` / `error`
 * UI state so the modal can stay focused on layout and gesture
 * composition.
 */
export const useCropConfirm = ({
  sourceUri,
  shape,
  outputFormat,
  outputMask,
  outputCutout,
  outputQuality,
  maxOutputSize,
  onConfirm,
  onError,
  errorMessage,
}: UseCropConfirmArgs): UseCropConfirmReturn => {
  const [cropping, setCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = useCallback(
    async (rect: CropRect) => {
      setCropping(true);
      setError(null);
      try {
        const displaySize = computeDisplaySize(rect.size, maxOutputSize);
        // `outputMask` and `outputCutout` are mutually exclusive
        // (enforced in assertProps) and both require a non-rect
        // string-path shape. Narrow to whichever is active (or null).
        const shapedPath = isOutputMaskableShape(shape)
          ? (shape!.mask as string)
          : null;
        const activeMask =
          shapedPath !== null && outputMask !== undefined ? outputMask : null;
        const activeCutout =
          shapedPath !== null && outputCutout !== undefined
            ? outputCutout
            : null;
        // Skia post-process always emits PNG — alpha channel required
        // for the cutout / transparent-mask regions.
        const format: OutputFormat =
          activeMask !== null || activeCutout !== null ? 'png' : outputFormat;
        const rectResult = await ImageEditor.cropImage(sourceUri, {
          offset: rect.offset,
          size: rect.size,
          ...(displaySize ? { displaySize } : {}),
          format,
          quality: outputQuality,
        });

        if (activeMask !== null) {
          const masked = await applyOutputMask({
            sourceUri: rectResult.uri,
            shapePath: shapedPath!,
            mask: activeMask,
          });
          onConfirm(masked);
        } else if (activeCutout !== null) {
          const cut = await applyOutputCutout({
            sourceUri: rectResult.uri,
            shapePath: shapedPath!,
            cutout: activeCutout,
          });
          onConfirm(cut);
        } else {
          onConfirm({
            uri: rectResult.uri,
            width: rectResult.width,
            height: rectResult.height,
          });
        }
      } catch (e) {
        console.error(`${LOG_PREFIX} Crop failed`, e);
        setError(errorMessage);
        onError?.(e);
      } finally {
        setCropping(false);
      }
    },
    [
      sourceUri,
      shape,
      outputFormat,
      outputMask,
      outputCutout,
      outputQuality,
      maxOutputSize,
      onConfirm,
      onError,
      errorMessage,
    ]
  );

  const clearError = useCallback(() => setError(null), []);

  return { confirm, cropping, error, clearError };
};
