/**
 * Unit tests for `applyOutputCutout`. Mocks `@shopify/react-native-skia`
 * so the pipeline can run without the peer actually installed.
 */

type MockSkia = ReturnType<typeof createMockSkia>;

function createMockSkia() {
  const drawImage = jest.fn();
  const drawRect = jest.fn();
  const drawPath = jest.fn();
  const clipPath = jest.fn();
  const save = jest.fn();
  const restore = jest.fn();
  const canvas = { drawImage, drawRect, drawPath, clipPath, save, restore };

  const encodeToBase64 = jest.fn().mockReturnValue('BASE64PAYLOAD');
  const encodeToBytes = jest.fn().mockReturnValue(new Uint8Array([1, 2, 3]));
  const snapshot = { encodeToBase64, encodeToBytes };

  const surface = {
    getCanvas: () => canvas,
    makeImageSnapshot: () => snapshot,
  };
  const SurfaceMake = jest.fn().mockReturnValue(surface);

  const image = { width: () => 200, height: () => 200 };
  const MakeImageFromEncoded = jest.fn().mockReturnValue(image);

  // Heart-ish bounds in the shape's 24-unit viewBox:
  // x=2, y=3, w=20, h=18. Scales to a ~166.67×150 tight bbox
  // against a 200×200 rect crop.
  const pathTransform = jest.fn();
  const getBounds = jest
    .fn()
    .mockReturnValue({ x: 2, y: 3, width: 20, height: 18 });
  const path = { transform: pathTransform, getBounds };
  const MakeFromSVGString = jest.fn().mockReturnValue(path);

  const paint = {
    setColor: jest.fn(),
    setStyle: jest.fn(),
    setStrokeWidth: jest.fn(),
    setAntiAlias: jest.fn(),
  };

  const matrixScale = jest.fn();
  const matrixTranslate = jest.fn();
  const matrix = { scale: matrixScale, translate: matrixTranslate };

  const Skia = {
    Image: { MakeImageFromEncoded },
    Data: {
      fromURI: jest.fn().mockResolvedValue('DATA'),
      fromBase64: jest.fn(),
    },
    Surface: { Make: SurfaceMake },
    Path: { MakeFromSVGString },
    Matrix: jest.fn().mockReturnValue(matrix),
    Paint: jest.fn().mockReturnValue(paint),
    Color: jest.fn().mockReturnValue(0x00000000),
  };

  return {
    Skia,
    ClipOp: { Difference: 0, Intersect: 1 },
    PaintStyle: { Fill: 0, Stroke: 1 },
    ImageFormat: { PNG: 4, JPEG: 3 },
    spies: {
      SurfaceMake,
      MakeImageFromEncoded,
      MakeFromSVGString,
      drawImage,
      drawRect,
      drawPath,
      clipPath,
      save,
      restore,
      encodeToBase64,
      encodeToBytes,
      getBounds,
      pathTransform,
      matrixScale,
      matrixTranslate,
    },
  };
}

// Must be `mock*`-prefixed for Jest's hoist allowlist.
let mockSkia: MockSkia = createMockSkia();

jest.mock(
  '@shopify/react-native-skia',
  () => ({
    get Skia() {
      return mockSkia.Skia;
    },
    get ClipOp() {
      return mockSkia.ClipOp;
    },
    get PaintStyle() {
      return mockSkia.PaintStyle;
    },
    get ImageFormat() {
      return mockSkia.ImageFormat;
    },
  }),
  { virtual: true }
);

import { applyOutputCutout } from '../utils/cutoutOutput';

const HEART_PATH =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z';

beforeEach(() => {
  mockSkia = createMockSkia();
});

describe('applyOutputCutout', () => {
  it('returns a base64 data URI sized to the tight bbox + padding', async () => {
    const result = await applyOutputCutout({
      sourceUri: 'file:///tmp/cropped.png',
      shapePath: HEART_PATH,
      cutout: { padding: 4 },
    });

    // Image is 200×200; path bbox scales from (2,3,20,18) 24-unit →
    // tight bbox 166.67 × 150 in pixel space
    // (20 × 200/24 = 166.67; 18 × 200/24 = 150).
    // + 2 × 4px padding per axis → 174.67 × 158 → round → 175 × 158.
    expect(result.uri).toBe('data:image/png;base64,BASE64PAYLOAD');
    expect(result.width).toBe(175);
    expect(result.height).toBe(158);

    expect(mockSkia.spies.SurfaceMake).toHaveBeenCalledWith(175, 158);
    expect(mockSkia.spies.getBounds).toHaveBeenCalledTimes(1);
  });

  it('applies fill → clip → drawImage → stroke order', async () => {
    await applyOutputCutout({
      sourceUri: 'file:///tmp/cropped.png',
      shapePath: HEART_PATH,
      cutout: { color: '#123456', stroke: { color: '#ffffff', width: 2 } },
    });

    const order = [
      mockSkia.spies.drawRect.mock.invocationCallOrder[0],
      mockSkia.spies.save.mock.invocationCallOrder[0],
      mockSkia.spies.clipPath.mock.invocationCallOrder[0],
      mockSkia.spies.drawImage.mock.invocationCallOrder[0],
      mockSkia.spies.restore.mock.invocationCallOrder[0],
      mockSkia.spies.drawPath.mock.invocationCallOrder[0],
    ];
    order.forEach((n) => expect(n).toBeDefined());
    for (let i = 1; i < order.length; i++) {
      expect(order[i]!).toBeGreaterThan(order[i - 1]!);
    }
  });

  it('invokes onBytes with Uint8Array + meta and uses its return as uri', async () => {
    const onBytes = jest.fn().mockResolvedValue('file:///tmp/persisted.png');

    const result = await applyOutputCutout({
      sourceUri: 'file:///tmp/cropped.png',
      shapePath: HEART_PATH,
      cutout: { onBytes },
    });

    expect(mockSkia.spies.encodeToBytes).toHaveBeenCalledTimes(1);
    expect(mockSkia.spies.encodeToBase64).not.toHaveBeenCalled();
    expect(onBytes).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
        format: 'png',
      })
    );
    expect(result.uri).toBe('file:///tmp/persisted.png');
  });

  it('throws a clear error when Skia fails to decode the image', async () => {
    mockSkia.Skia.Image.MakeImageFromEncoded = jest.fn().mockReturnValue(null);
    await expect(
      applyOutputCutout({
        sourceUri: 'file:///tmp/cropped.png',
        shapePath: HEART_PATH,
        cutout: {},
      })
    ).rejects.toThrow(/failed to decode/);
  });

  it('throws a clear error when Skia fails to parse the shape path', async () => {
    mockSkia.Skia.Path.MakeFromSVGString = jest.fn().mockReturnValue(null);
    await expect(
      applyOutputCutout({
        sourceUri: 'file:///tmp/cropped.png',
        shapePath: 'not a real path',
        cutout: {},
      })
    ).rejects.toThrow(/failed to parse shape path/);
  });
});
