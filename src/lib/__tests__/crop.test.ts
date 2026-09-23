import { describe, expect, it } from 'vitest';
import { centeredFraming, frameCrop } from '../crop';

describe('frameCrop', () => {
    it('keeps the whole source at its own shape and no zoom', () => {
        expect(
            frameCrop(centeredFraming(null, 4032, 3024), 4032, 3024),
        ).toEqual({ x: 0, y: 0, width: 4032, height: 3024 });
    });

    it('fits the largest frame of a different shape, centred', () => {
        expect(frameCrop(centeredFraming(1, 4032, 3024), 4032, 3024)).toEqual({
            x: 504,
            y: 0,
            width: 3024,
            height: 3024,
        });
    });

    it('shrinks the frame by the zoom around its centre', () => {
        const framing = { ...centeredFraming(1, 4000, 3000), zoom: 2 };
        expect(frameCrop(framing, 4000, 3000)).toEqual({
            x: 1250,
            y: 750,
            width: 1500,
            height: 1500,
        });
    });

    it('pulls a centre past the edge back inside the source', () => {
        const framing = {
            aspect: 1,
            zoom: 2,
            centerX: -500,
            centerY: 99_999,
        };
        expect(frameCrop(framing, 4000, 3000)).toEqual({
            x: 0,
            y: 1500,
            width: 1500,
            height: 1500,
        });
    });
});
