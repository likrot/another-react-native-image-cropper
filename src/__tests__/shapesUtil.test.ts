import {
  circleShape,
  heartShape,
  rectangleShape,
  isOutputMaskableShape,
  isShapedOverlay,
  type Shape,
} from '../shapes';

describe('isShapedOverlay', () => {
  it('is false when no shape is provided', () => {
    expect(isShapedOverlay(undefined)).toBe(false);
  });

  it('is false for the rectangle shape (fills its own bounding box)', () => {
    expect(isShapedOverlay(rectangleShape)).toBe(false);
  });

  it('is true for built-in non-rectangular shapes', () => {
    expect(isShapedOverlay(heartShape)).toBe(true);
    expect(isShapedOverlay(circleShape)).toBe(true);
  });

  it('is true for a consumer shape with a function-form mask', () => {
    const fnMaskShape: Shape = {
      id: 'custom',
      aspectRatio: 1,
      mask: () => null as never,
    };
    expect(isShapedOverlay(fnMaskShape)).toBe(true);
  });
});

describe('isOutputMaskableShape', () => {
  it('is false for undefined and rectangle', () => {
    expect(isOutputMaskableShape(undefined)).toBe(false);
    expect(isOutputMaskableShape(rectangleShape)).toBe(false);
  });

  it('is true for non-rectangular string-path shapes', () => {
    expect(isOutputMaskableShape(heartShape)).toBe(true);
    expect(isOutputMaskableShape(circleShape)).toBe(true);
  });

  it('is false for function-form masks — Skia composite needs a path string', () => {
    const fnMaskShape: Shape = {
      id: 'custom',
      aspectRatio: 1,
      mask: () => null as never,
    };
    expect(isOutputMaskableShape(fnMaskShape)).toBe(false);
  });
});
