/**
 * Full-screen crop modal — the public entry point of the library.
 *
 * Thin shell: runs prop validation, deep-merges the theme, wires up
 * the provider stack (gesture root → safe-area → theme → icons), and
 * hands off to `ModalContent` for the actual UI.
 */

import { forwardRef, useMemo } from 'react';
import { Modal, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { defaultTheme } from '../../constants/theme';
import { IconProvider } from '../../context/IconContext';
import { ThemeProvider } from '../../context/ThemeContext';
import type { ImageCropperHandle } from '../../types';
import { mergeTheme } from '../../utils/mergeTheme';
import { assertProps } from './assertProps';
import { ModalContent } from './ModalContent';
import type { ImageCropperModalProps } from './types';

export type {
  FooterRenderProps,
  ImageCropperLabels,
  ImageCropperModalProps,
  ToolbarRenderProps,
} from './types';

export const ImageCropperModal = forwardRef<
  ImageCropperHandle,
  ImageCropperModalProps
>((props, ref) => {
  assertProps(props);
  const mergedTheme = useMemo(
    () => mergeTheme(defaultTheme, props.theme),
    [props.theme]
  );
  return (
    <Modal
      visible={props.visible}
      transparent={false}
      animationType="slide"
      onRequestClose={props.onCancel}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaProvider>
          <ThemeProvider value={mergedTheme}>
            <IconProvider overrides={props.icons}>
              <ModalContent {...props} ref={ref} />
            </IconProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
});
ImageCropperModal.displayName = 'ImageCropperModal';

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
});
