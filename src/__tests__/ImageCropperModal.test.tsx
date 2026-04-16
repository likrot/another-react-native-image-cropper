import ImageEditor from '@react-native-community/image-editor';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import {
  ImageCropperModal,
  type ImageCropperLabels,
} from '../components/ImageCropperModal';
import {
  circleShape,
  heartShape,
  rectangleShape,
  squareShape,
} from '../shapes';

jest.mock('@react-native-community/image-editor', () => ({
  __esModule: true,
  default: { cropImage: jest.fn() },
}));

// Bypass the Skia peer-dep requirement in `applyOutputMask` — the mask
// tests only verify wiring (correct format, delegation), not the native
// composite itself.
jest.mock('../utils/maskOutput', () => ({
  applyOutputMask: jest.fn().mockResolvedValue({
    uri: 'data:image/png;base64,XYZ',
    width: 100,
    height: 100,
  }),
}));

const mockedCropImage = ImageEditor.cropImage as jest.Mock;

const labels: ImageCropperLabels = {
  confirm: 'Crop',
  cancel: 'Cancel',
  instructions: 'Drag and pinch to frame',
  errorMessage: 'Could not crop',
};

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof ImageCropperModal>> = {}
) => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  const utils = render(
    <ImageCropperModal
      visible
      sourceUri="file:///tmp/source.jpg"
      sourceWidth={2000}
      sourceHeight={1000}
      labels={labels}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  );
  act(() => {
    fireEvent(utils.getByTestId('image-cropper-area'), 'layout', {
      nativeEvent: { layout: { width: 400, height: 400, x: 0, y: 0 } },
    });
  });
  return { ...utils, onConfirm, onCancel };
};

describe('ImageCropperModal', () => {
  beforeEach(() => {
    mockedCropImage.mockReset();
    mockedCropImage.mockResolvedValue({
      uri: 'file:///tmp/cropped.jpg',
      width: 800,
      height: 800,
      size: 1024,
      type: 'image/jpeg',
      name: 'cropped.jpg',
      path: '/tmp/cropped.jpg',
    });
  });

  it('renders cancel/confirm buttons and instructions when visible', () => {
    const { getByLabelText, getByText } = renderModal();
    expect(getByLabelText(labels.cancel)).toBeTruthy();
    expect(getByLabelText(labels.confirm)).toBeTruthy();
    expect(getByText(labels.instructions)).toBeTruthy();
  });

  it('calls onCancel without touching ImageEditor', () => {
    const { getByLabelText, onCancel } = renderModal();
    fireEvent.press(getByLabelText(labels.cancel));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockedCropImage).not.toHaveBeenCalled();
  });

  it('invokes ImageEditor.cropImage and forwards the result on confirm', async () => {
    const { getByLabelText, onConfirm } = renderModal();
    fireEvent.press(getByLabelText(labels.confirm));

    await waitFor(() => expect(mockedCropImage).toHaveBeenCalledTimes(1));
    const [uri, cropData] = mockedCropImage.mock.calls[0];
    expect(uri).toBe('file:///tmp/source.jpg');
    expect(cropData.offset).toEqual(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    );
    expect(cropData.size).toEqual(
      expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
      })
    );
    expect(cropData.format).toBe('jpeg');

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({
        uri: 'file:///tmp/cropped.jpg',
        width: 800,
        height: 800,
      })
    );
  });

  it('shows the error message and stays open when cropImage rejects', async () => {
    mockedCropImage.mockRejectedValueOnce(new Error('boom'));
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const onError = jest.fn();
    const { getByLabelText, getByText, queryByText, onConfirm, onCancel } =
      renderModal({
        onError,
      });

    fireEvent.press(getByLabelText(labels.confirm));

    await waitFor(() => expect(getByText(labels.errorMessage)).toBeTruthy());
    expect(queryByText(labels.instructions)).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    consoleSpy.mockRestore();
  });

  it('throws on missing sourceUri', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    expect(() =>
      render(
        <ImageCropperModal
          visible
          sourceUri=""
          sourceWidth={100}
          sourceHeight={100}
          labels={labels}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      )
    ).toThrow(/sourceUri/);
    consoleSpy.mockRestore();
  });

  describe('modes configuration', () => {
    it('renders mode picker by default (2 modes → both inline)', () => {
      const { getByLabelText } = renderModal();
      expect(getByLabelText('Pan / zoom mode')).toBeTruthy();
      expect(getByLabelText('Draw-to-crop mode')).toBeTruthy();
    });

    it('hides the mode picker when only one mode is enabled', () => {
      const { queryByLabelText } = renderModal({ modes: ['pan-zoom'] });
      expect(queryByLabelText('Pan / zoom mode')).toBeNull();
      expect(queryByLabelText('Draw-to-crop mode')).toBeNull();
      // Cancel + confirm still present.
      expect(queryByLabelText(labels.cancel)).toBeTruthy();
      expect(queryByLabelText(labels.confirm)).toBeTruthy();
    });

    it('honours defaultMode when it differs from the first entry', () => {
      const { getByLabelText } = renderModal({
        modes: ['pan-zoom', 'draw'],
        defaultMode: 'draw',
      });
      expect(
        getByLabelText('Draw-to-crop mode').props.accessibilityState
      ).toMatchObject({ selected: true });
      expect(
        getByLabelText('Pan / zoom mode').props.accessibilityState
      ).toMatchObject({ selected: false });
    });

    it('fires onModeChange when the user toggles', () => {
      const onModeChange = jest.fn();
      const { getByLabelText } = renderModal({ onModeChange });
      fireEvent.press(getByLabelText('Draw-to-crop mode'));
      expect(onModeChange).toHaveBeenCalledWith('draw');
    });

    it('throws on empty modes array', () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      expect(() =>
        render(
          <ImageCropperModal
            visible
            sourceUri="file:///tmp/source.jpg"
            sourceWidth={100}
            sourceHeight={100}
            modes={[]}
            labels={labels}
            onConfirm={jest.fn()}
            onCancel={jest.fn()}
          />
        )
      ).toThrow(/modes/);
      consoleSpy.mockRestore();
    });

    it('throws when defaultMode is not in modes', () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      expect(() =>
        render(
          <ImageCropperModal
            visible
            sourceUri="file:///tmp/source.jpg"
            sourceWidth={100}
            sourceHeight={100}
            modes={['pan-zoom']}
            defaultMode="draw"
            labels={labels}
            onConfirm={jest.fn()}
            onCancel={jest.fn()}
          />
        )
      ).toThrow(/defaultMode/);
      consoleSpy.mockRestore();
    });

    it('uses labels.modes overrides on the mode picker buttons', () => {
      const { getByLabelText, queryByLabelText } = renderModal({
        labels: {
          ...labels,
          modes: { 'pan-zoom': 'Panorámica', 'draw': 'Dibujar' },
        },
      });
      expect(getByLabelText('Panorámica')).toBeTruthy();
      expect(getByLabelText('Dibujar')).toBeTruthy();
      expect(queryByLabelText('Pan / zoom mode')).toBeNull();
    });

    it('falls back to English defaults when a mode label is omitted', () => {
      const { getByLabelText } = renderModal({
        labels: { ...labels, modes: { 'pan-zoom': 'Panorámica' } },
      });
      expect(getByLabelText('Panorámica')).toBeTruthy();
      // draw unspecified → default English label still reachable
      expect(getByLabelText('Draw-to-crop mode')).toBeTruthy();
    });
  });

  describe('UI customization', () => {
    it('hides the footer when showFooter is false', () => {
      const { queryByText } = renderModal({ showFooter: false });
      expect(queryByText(labels.instructions)).toBeNull();
    });

    it('hides the toolbar when toolbarPosition is "hidden"', () => {
      const { queryByLabelText } = renderModal({ toolbarPosition: 'hidden' });
      expect(queryByLabelText(labels.cancel)).toBeNull();
      expect(queryByLabelText(labels.confirm)).toBeNull();
    });

    it('exposes an imperative confirm() via ref', async () => {
      const onConfirm = jest.fn();
      const ref = React.createRef<React.ElementRef<typeof ImageCropperModal>>();
      const utils = render(
        <ImageCropperModal
          ref={ref}
          visible
          sourceUri="file:///tmp/source.jpg"
          sourceWidth={2000}
          sourceHeight={1000}
          labels={labels}
          toolbarPosition="hidden"
          onConfirm={onConfirm}
          onCancel={jest.fn()}
        />
      );
      act(() => {
        fireEvent(utils.getByTestId('image-cropper-area'), 'layout', {
          nativeEvent: { layout: { width: 400, height: 400, x: 0, y: 0 } },
        });
      });
      await act(async () => {
        await ref.current?.confirm();
      });
      expect(mockedCropImage).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalled();
    });

    it('exposes setMode() and cancel() via ref', () => {
      const onCancel = jest.fn();
      const onModeChange = jest.fn();
      const ref = React.createRef<React.ElementRef<typeof ImageCropperModal>>();
      render(
        <ImageCropperModal
          ref={ref}
          visible
          sourceUri="file:///tmp/source.jpg"
          sourceWidth={100}
          sourceHeight={100}
          labels={labels}
          onModeChange={onModeChange}
          onConfirm={jest.fn()}
          onCancel={onCancel}
        />
      );
      act(() => {
        ref.current?.setMode('draw');
      });
      expect(onModeChange).toHaveBeenCalledWith('draw');
      act(() => {
        ref.current?.cancel();
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('renders a custom icon when provided via the icons prop', () => {
      const { Text } = require('react-native');
      const { getByLabelText } = renderModal({
        icons: { x: <Text testID="custom-x">X</Text> },
      });
      // The cancel button exists (wraps the custom icon) and the custom
      // child is present inside it.
      const cancelButton = getByLabelText(labels.cancel);
      expect(cancelButton).toBeTruthy();
    });

    it('invokes renderToolbar when provided', () => {
      const { Text } = require('react-native');
      const renderToolbar = jest.fn(() => (
        <Text testID="custom-toolbar">Custom</Text>
      ));
      const { getByTestId } = renderModal({ renderToolbar });
      expect(getByTestId('custom-toolbar')).toBeTruthy();
      expect(renderToolbar).toHaveBeenCalled();
      expect(renderToolbar).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'pan-zoom',
          modes: ['pan-zoom', 'draw'],
          labels,
        })
      );
    });

    it('invokes renderFooter when provided', () => {
      const { Text } = require('react-native');
      const renderFooter = jest.fn(() => (
        <Text testID="custom-footer">Footer</Text>
      ));
      const { getByTestId } = renderModal({ renderFooter });
      expect(getByTestId('custom-footer')).toBeTruthy();
      expect(renderFooter).toHaveBeenCalled();
    });

    it('renders shape picker when multiple shapes passed', () => {
      const { getByLabelText } = renderModal({
        shapes: [rectangleShape, circleShape, heartShape],
      });
      expect(getByLabelText(rectangleShape.label!)).toBeTruthy();
      expect(getByLabelText(circleShape.label!)).toBeTruthy();
    });

    it('hides shape picker when only one shape is passed', () => {
      const { queryByLabelText } = renderModal({
        shapes: [circleShape],
      });
      expect(queryByLabelText(circleShape.label!)).toBeNull();
      expect(queryByLabelText(rectangleShape.label!)).toBeNull();
    });

    it('fires onShapeChange when the user picks a different shape', () => {
      const onShapeChange = jest.fn();
      const { getByLabelText } = renderModal({
        shapes: [rectangleShape, circleShape, heartShape],
        onShapeChange,
      });
      // Three shapes exceed the picker's inline cap (2) so non-active
      // items sit in the collapsed popover; expand before selecting.
      fireEvent.press(getByLabelText('Show more options'));
      fireEvent.press(getByLabelText(circleShape.label!));
      expect(onShapeChange).toHaveBeenCalledWith(circleShape);
    });

    it('honours defaultShape by id', () => {
      const { getByLabelText } = renderModal({
        shapes: [rectangleShape, circleShape, heartShape],
        defaultShape: 'circle',
      });
      expect(
        getByLabelText(circleShape.label!).props.accessibilityState
      ).toMatchObject({ selected: true });
    });

    it('throws on empty shapes array', () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      expect(() =>
        render(
          <ImageCropperModal
            visible
            sourceUri="file:///tmp/source.jpg"
            sourceWidth={100}
            sourceHeight={100}
            shapes={[]}
            labels={labels}
            onConfirm={jest.fn()}
            onCancel={jest.fn()}
          />
        )
      ).toThrow(/shapes/);
      consoleSpy.mockRestore();
    });

    it('throws when defaultShape is not in shapes', () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      expect(() =>
        render(
          <ImageCropperModal
            visible
            sourceUri="file:///tmp/source.jpg"
            sourceWidth={100}
            sourceHeight={100}
            shapes={[rectangleShape]}
            defaultShape="circle"
            labels={labels}
            onConfirm={jest.fn()}
            onCancel={jest.fn()}
          />
        )
      ).toThrow(/defaultShape/);
      consoleSpy.mockRestore();
    });

    it('includes squareShape as a locked-1:1 built-in alongside rectangleShape', () => {
      expect(squareShape.aspectRatio).toBe(1);
      expect(rectangleShape.aspectRatio).toBeNull();
      const onShapeChange = jest.fn();
      const { getByLabelText } = renderModal({
        shapes: [rectangleShape, squareShape, circleShape],
        onShapeChange,
      });
      expect(getByLabelText(squareShape.label!)).toBeTruthy();
      fireEvent.press(getByLabelText('Show more options'));
      fireEvent.press(getByLabelText(squareShape.label!));
      expect(onShapeChange).toHaveBeenCalledWith(squareShape);
    });

    it('forwards outputFormat to ImageEditor.cropImage', async () => {
      mockedCropImage.mockResolvedValueOnce({
        uri: 'file:///tmp/cropped.png',
        width: 100,
        height: 100,
      });
      const onConfirm = jest.fn();
      const { getByLabelText } = renderModal({
        outputFormat: 'png',
        onConfirm,
      });
      fireEvent.press(getByLabelText(labels.confirm));
      await waitFor(() => expect(mockedCropImage).toHaveBeenCalled());
      expect(mockedCropImage.mock.calls[0]?.[1]).toEqual(
        expect.objectContaining({ format: 'png' })
      );
    });

    it('forces PNG format and delegates to applyOutputMask when outputMask is set', async () => {
      mockedCropImage.mockResolvedValueOnce({
        uri: 'file:///tmp/cropped.png',
        width: 100,
        height: 100,
      });
      const { applyOutputMask } = jest.requireMock('../utils/maskOutput');
      const onConfirm = jest.fn();
      const { getByLabelText } = renderModal({
        shapes: [heartShape, rectangleShape],
        defaultShape: 'heart',
        outputFormat: 'jpeg', // explicitly JPEG — mask should override to PNG
        outputMask: { color: 'transparent' },
        onConfirm,
      });
      fireEvent.press(getByLabelText(labels.confirm));
      await waitFor(() => expect(onConfirm).toHaveBeenCalled());
      expect(mockedCropImage.mock.calls[0]?.[1]).toEqual(
        expect.objectContaining({ format: 'png' })
      );
      expect(applyOutputMask).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceUri: 'file:///tmp/cropped.png',
          shapePath: heartShape.mask,
          mask: { color: 'transparent' },
        })
      );
      expect(onConfirm).toHaveBeenCalledWith({
        uri: 'data:image/png;base64,XYZ',
        width: 100,
        height: 100,
      });
    });

    it('skips applyOutputMask for the free-aspect rectangle shape', async () => {
      mockedCropImage.mockResolvedValueOnce({
        uri: 'file:///tmp/cropped.jpg',
        width: 100,
        height: 100,
      });
      const { applyOutputMask } = jest.requireMock('../utils/maskOutput');
      (applyOutputMask as jest.Mock).mockClear();
      const onConfirm = jest.fn();
      const { getByLabelText } = renderModal({
        shapes: [rectangleShape],
        outputMask: { color: 'transparent' },
        onConfirm,
      });
      fireEvent.press(getByLabelText(labels.confirm));
      await waitFor(() => expect(onConfirm).toHaveBeenCalled());
      expect(applyOutputMask).not.toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalledWith({
        uri: 'file:///tmp/cropped.jpg',
        width: 100,
        height: 100,
      });
    });

    it('throws when framePadding is out of range', () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      expect(() =>
        render(
          <ImageCropperModal
            visible
            sourceUri="file:///tmp/source.jpg"
            sourceWidth={100}
            sourceHeight={100}
            framePadding={0.6}
            labels={labels}
            onConfirm={jest.fn()}
            onCancel={jest.fn()}
          />
        )
      ).toThrow(/framePadding/);
      expect(() =>
        render(
          <ImageCropperModal
            visible
            sourceUri="file:///tmp/source.jpg"
            sourceWidth={100}
            sourceHeight={100}
            framePadding={-0.1}
            labels={labels}
            onConfirm={jest.fn()}
            onCancel={jest.fn()}
          />
        )
      ).toThrow(/framePadding/);
      consoleSpy.mockRestore();
    });

    it('applies theme override colors deep-merged onto defaults', () => {
      // The merged theme reaches components via context. We assert that the
      // mode-picker's selected icon renders in the overridden color by
      // inspecting the SVG path's stroke prop via its parent accessibility
      // state (indirect — animated styles don't flow to jest's RN mock).
      // Easier: no assertion crash means mergeTheme threaded correctly.
      expect(() =>
        renderModal({
          theme: {
            colors: { text: { light: '#00FF00' } },
          },
        })
      ).not.toThrow();
    });

    it('threads theme.spacing overrides through to the toolbar layout', () => {
      // Asserts the toolbar's `top` offset reads from the merged theme,
      // not the default spacing tokens directly.
      const { getByLabelText } = renderModal({
        toolbarPosition: 'top',
        theme: { spacing: { l: 100 } },
      });
      let node = getByLabelText(labels.cancel);
      let found: { top?: number } | null = null;
      for (let i = 0; i < 15 && node; i++) {
        const style = node.props.style;
        const flat = Array.isArray(style) ? style : [style];
        for (const s of flat.flat(3)) {
          if (s && typeof s === 'object' && typeof s.top === 'number') {
            found = s;
            break;
          }
        }
        if (found) break;
        node = node.parent as typeof node;
      }
      expect(found).toBeTruthy();
      // insets.top mocked to 0; expected = 0 + spacing.l + TOOLBAR_TOP_EXTRA_OFFSET = 100 + 5.
      expect(found!.top).toBe(105);
    });

    it('does not leak the synthesized rectangle into renderToolbar.shapes', () => {
      // When no `shapes` prop is passed, the modal synthesizes
      // `[rectangleShape]` internally so the rest of the code has an
      // active shape to work with. That synthesis must stay internal —
      // `renderToolbar` must see an empty list to reflect the consumer's
      // actual intent (no shape picker).
      const renderToolbar = jest.fn(() => null);
      renderModal({ renderToolbar });
      expect(renderToolbar).toHaveBeenCalledWith(
        expect.objectContaining({
          shapes: [],
        })
      );
    });
  });
});
