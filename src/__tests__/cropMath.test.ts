import {
  computeBaseScale,
  computeCropRect,
  computeCropRectFromRect,
  computeDisplaySize,
  computeFrameSize,
  computePanLimit,
} from '../utils/cropMath';

describe('cropMath', () => {
  describe('computeFrameSize', () => {
    it('returns the full container when no aspect ratio is given', () => {
      expect(computeFrameSize({ width: 300, height: 500 })).toEqual({
        width: 300,
        height: 500,
      });
    });

    it('fits a 1:1 frame inside a tall container', () => {
      expect(computeFrameSize({ width: 300, height: 500 }, 1)).toEqual({
        width: 300,
        height: 300,
      });
    });

    it('fits a 1:1 frame inside a wide container', () => {
      expect(computeFrameSize({ width: 500, height: 300 }, 1)).toEqual({
        width: 300,
        height: 300,
      });
    });

    it('fits a 4:3 frame inside a square container (width-driven)', () => {
      expect(computeFrameSize({ width: 400, height: 400 }, 4 / 3)).toEqual({
        width: 400,
        height: 300,
      });
    });

    it('falls back to free aspect when ratio is non-positive', () => {
      expect(computeFrameSize({ width: 200, height: 100 }, 0)).toEqual({
        width: 200,
        height: 100,
      });
    });
  });

  describe('computeBaseScale (contain fit)', () => {
    it('fits a landscape source inside a square frame by width', () => {
      const scale = computeBaseScale(
        { width: 2000, height: 1000 },
        { width: 400, height: 400 }
      );
      expect(scale).toBeCloseTo(0.2);
    });

    it('fits a portrait source inside a square frame by height', () => {
      const scale = computeBaseScale(
        { width: 1000, height: 2000 },
        { width: 400, height: 400 }
      );
      expect(scale).toBeCloseTo(0.2);
    });

    it('scales up when the source is smaller than the frame', () => {
      const scale = computeBaseScale(
        { width: 100, height: 100 },
        { width: 400, height: 400 }
      );
      expect(scale).toBeCloseTo(4);
    });
  });

  describe('computePanLimit', () => {
    it('is zero when displayed equals frame', () => {
      expect(computePanLimit(400, 400)).toBe(0);
    });

    it('is half the overflow otherwise', () => {
      expect(computePanLimit(600, 400)).toBe(100);
    });

    it('never returns a negative value', () => {
      expect(computePanLimit(300, 400)).toBe(0);
    });
  });

  describe('computeCropRect', () => {
    const source = { width: 2000, height: 1000 };
    const frame = { width: 400, height: 400 };
    // baseScale = min(400/2000, 400/1000) = 0.2

    it('returns the whole image at the identity transform (contain fit)', () => {
      const rect = computeCropRect({
        source,
        frame,
        scale: 1,
        translateX: 0,
        translateY: 0,
      });
      expect(rect.offset).toEqual({ x: 0, y: 0 });
      expect(rect.size).toEqual({ width: 2000, height: 1000 });
    });

    it('centers the crop when zoomed in enough to fill the frame on both axes', () => {
      // scale = 2 → totalScale = 0.4, displayedW = 800 (> frame.w), displayedH = 400 (== frame.h)
      const rect = computeCropRect({
        source,
        frame,
        scale: 2,
        translateX: 0,
        translateY: 0,
      });
      expect(rect.offset.x).toBeCloseTo(500);
      expect(rect.offset.y).toBeCloseTo(0);
      expect(rect.size.width).toBeCloseTo(1000);
      expect(rect.size.height).toBeCloseTo(1000);
    });

    it('shifts crop rightward when the user pans left after zooming', () => {
      const rect = computeCropRect({
        source,
        frame,
        scale: 2,
        translateX: -80,
        translateY: 0,
      });
      // rawOffsetX = (800-400)/2 - (-80) = 280, / 0.4 = 700
      expect(rect.offset.x).toBeCloseTo(700);
    });

    it('clamps offset into source bounds when pan goes past the edge', () => {
      const rect = computeCropRect({
        source,
        frame,
        scale: 2,
        translateX: 100000,
        translateY: 100000,
      });
      expect(rect.offset.x).toBeGreaterThanOrEqual(0);
      expect(rect.offset.y).toBeGreaterThanOrEqual(0);
      expect(rect.offset.x + rect.size.width).toBeLessThanOrEqual(
        source.width + 1e-6
      );
      expect(rect.offset.y + rect.size.height).toBeLessThanOrEqual(
        source.height + 1e-6
      );
    });

    it('returns the whole image for a portrait source at identity transform', () => {
      const rect = computeCropRect({
        source: { width: 1000, height: 2000 },
        frame: { width: 300, height: 500 },
        scale: 1,
        translateX: 0,
        translateY: 0,
      });
      expect(rect.offset).toEqual({ x: 0, y: 0 });
      expect(rect.size).toEqual({ width: 1000, height: 2000 });
    });
  });

  describe('computeCropRectFromRect', () => {
    // Landscape source in a square container.
    // baseScale = min(400/2000, 400/1000) = 0.2
    // Displayed image at scale=1: 400 × 200, centered in 400 × 400.
    const source = { width: 2000, height: 1000 };
    const container = { width: 400, height: 400 };
    const baseScale = computeBaseScale(source, container);
    const dw = source.width * baseScale; // 400
    const dh = source.height * baseScale; // 200
    const originX = (container.width - dw) / 2; // 0
    const originY = (container.height - dh) / 2; // 100

    it('returns the whole source when the rect covers the entire fitted image', () => {
      const rect = computeCropRectFromRect({
        source,
        imageOriginX: originX,
        imageOriginY: originY,
        displayedWidth: dw,
        displayedHeight: dh,
        rect: { x: 0, y: 100, w: 400, h: 200 },
        scale: 1,
        translateX: 0,
        translateY: 0,
      });
      expect(rect.offset.x).toBeCloseTo(0);
      expect(rect.offset.y).toBeCloseTo(0);
      expect(rect.size.width).toBeCloseTo(2000);
      expect(rect.size.height).toBeCloseTo(1000);
    });

    it('maps a rect in the top-left quadrant of the fitted image', () => {
      const rect = computeCropRectFromRect({
        source,
        imageOriginX: originX,
        imageOriginY: originY,
        displayedWidth: dw,
        displayedHeight: dh,
        rect: { x: 0, y: 100, w: 200, h: 100 },
        scale: 1,
        translateX: 0,
        translateY: 0,
      });
      expect(rect.offset.x).toBeCloseTo(0);
      expect(rect.offset.y).toBeCloseTo(0);
      expect(rect.size.width).toBeCloseTo(1000);
      expect(rect.size.height).toBeCloseTo(500);
    });

    it('accounts for scale when zoomed in', () => {
      // scale=2 → totalScale=0.4, displayed: 800×400, origin: (-200, 0).
      const rect = computeCropRectFromRect({
        source,
        imageOriginX: originX,
        imageOriginY: originY,
        displayedWidth: dw,
        displayedHeight: dh,
        rect: { x: 0, y: 0, w: 400, h: 400 },
        scale: 2,
        translateX: 0,
        translateY: 0,
      });
      expect(rect.offset.x).toBeCloseTo(500);
      expect(rect.offset.y).toBeCloseTo(0);
      expect(rect.size.width).toBeCloseTo(1000);
      expect(rect.size.height).toBeCloseTo(1000);
    });

    it('shifts crop offset when image is translated', () => {
      // scale=2, translateX=80 → image shifted right by 80px.
      const rect = computeCropRectFromRect({
        source,
        imageOriginX: originX,
        imageOriginY: originY,
        displayedWidth: dw,
        displayedHeight: dh,
        rect: { x: 0, y: 0, w: 400, h: 400 },
        scale: 2,
        translateX: 80,
        translateY: 0,
      });
      expect(rect.offset.x).toBeCloseTo(300);
    });

    it('clamps to source bounds on floating-point drift', () => {
      const rect = computeCropRectFromRect({
        source,
        imageOriginX: originX,
        imageOriginY: originY,
        displayedWidth: dw,
        displayedHeight: dh,
        rect: { x: -5, y: 95, w: 410, h: 210 },
        scale: 1,
        translateX: 0,
        translateY: 0,
      });
      expect(rect.offset.x).toBeGreaterThanOrEqual(0);
      expect(rect.offset.y).toBeGreaterThanOrEqual(0);
      expect(rect.offset.x + rect.size.width).toBeLessThanOrEqual(
        source.width + 1e-6
      );
      expect(rect.offset.y + rect.size.height).toBeLessThanOrEqual(
        source.height + 1e-6
      );
    });

    it('handles a portrait source in a landscape container', () => {
      const portraitSource = { width: 1000, height: 2000 };
      const landscapeContainer = { width: 600, height: 400 };
      const pBaseScale = computeBaseScale(portraitSource, landscapeContainer);
      const pDw = portraitSource.width * pBaseScale; // 200
      const pDh = portraitSource.height * pBaseScale; // 400
      const pOriginX = (landscapeContainer.width - pDw) / 2; // 200
      const pOriginY = (landscapeContainer.height - pDh) / 2; // 0
      const rect = computeCropRectFromRect({
        source: portraitSource,
        imageOriginX: pOriginX,
        imageOriginY: pOriginY,
        displayedWidth: pDw,
        displayedHeight: pDh,
        rect: { x: 200, y: 0, w: 200, h: 400 },
        scale: 1,
        translateX: 0,
        translateY: 0,
      });
      expect(rect.offset.x).toBeCloseTo(0);
      expect(rect.offset.y).toBeCloseTo(0);
      expect(rect.size.width).toBeCloseTo(1000);
      expect(rect.size.height).toBeCloseTo(2000);
    });
  });

  describe('computeDisplaySize', () => {
    it('returns undefined when the crop is already within the cap', () => {
      expect(
        computeDisplaySize({ width: 800, height: 600 }, 1600)
      ).toBeUndefined();
    });

    it('scales down a landscape rect to cap the longer edge', () => {
      expect(computeDisplaySize({ width: 3200, height: 1600 }, 1600)).toEqual({
        width: 1600,
        height: 800,
      });
    });

    it('scales down a portrait rect to cap the longer edge', () => {
      expect(computeDisplaySize({ width: 1000, height: 4000 }, 1600)).toEqual({
        width: 400,
        height: 1600,
      });
    });
  });
});
