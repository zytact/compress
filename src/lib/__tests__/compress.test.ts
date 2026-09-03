import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    areSettingsCompressible,
    resolveOutputFormat,
    runCompression,
    runFit,
    usesQuality,
} from '../compress';
import { OutputFormat, fitToFilesize, resizeByDimensions } from '../wasm';
import type * as WasmModule from '../wasm';

// The encoders need WASM, so stub them and keep the real format helpers
vi.mock('../wasm', async (importActual) => ({
    ...(await importActual<typeof WasmModule>()),
    resizeByDimensions: vi.fn(),
    fitToFilesize: vi.fn(),
}));

// jsdom has no createImageBitmap, and these tests only assert byte sizes
vi.stubGlobal('createImageBitmap', () =>
    Promise.resolve({ width: 100, height: 100, close: () => {} }),
);

const settings = {
    width: 100,
    height: 100,
    format: OutputFormat.Jpeg,
    quality: 85,
};

describe('resolveOutputFormat', () => {
    it('keeps an explicitly requested format', () => {
        expect(resolveOutputFormat(OutputFormat.Png, 'JPEG')).toBe(
            OutputFormat.Png,
        );
    });

    it('resolves Original to the source format', () => {
        expect(resolveOutputFormat(OutputFormat.Original, 'PNG')).toBe(
            OutputFormat.Png,
        );
        expect(resolveOutputFormat(OutputFormat.Original, 'JPEG')).toBe(
            OutputFormat.Jpeg,
        );
    });

    it('falls back to JPEG for formats the encoder cannot emit', () => {
        expect(resolveOutputFormat(OutputFormat.Original, 'HEIC')).toBe(
            OutputFormat.Jpeg,
        );
        expect(resolveOutputFormat(OutputFormat.Original, null)).toBe(
            OutputFormat.Jpeg,
        );
    });
});

describe('usesQuality', () => {
    it('is false only when the output really is a PNG', () => {
        expect(usesQuality(OutputFormat.Png, 'JPEG')).toBe(false);
        expect(usesQuality(OutputFormat.Original, 'PNG')).toBe(false);
        expect(usesQuality(OutputFormat.Jpeg, 'PNG')).toBe(true);
        expect(usesQuality(OutputFormat.Original, 'HEIC')).toBe(true);
    });
});

describe('areSettingsCompressible', () => {
    it('rejects a half-typed size', () => {
        expect(areSettingsCompressible({ ...settings, width: 0 })).toBe(false);
    });

    it('accepts usable settings', () => {
        expect(areSettingsCompressible(settings)).toBe(true);
    });
});

describe('runCompression never returns a larger file', () => {
    const source = new Uint8Array(1000);

    beforeEach(() => {
        vi.mocked(resizeByDimensions).mockReset();
    });

    it('keeps the source when the requested format encodes larger', async () => {
        vi.mocked(resizeByDimensions).mockResolvedValue(new Uint8Array(4000));

        const result = await runCompression(
            source,
            { ...settings, format: OutputFormat.Png },
            'JPEG',
        );

        expect(result.keptOriginal).toBe(true);
        expect(result.blob.size).toBe(source.length);
        expect(result.format).toBe(OutputFormat.Jpeg);
    });

    it('uses the encoded result when it is smaller', async () => {
        vi.mocked(resizeByDimensions).mockResolvedValue(new Uint8Array(400));

        const result = await runCompression(
            source,
            { ...settings, format: OutputFormat.Png },
            'JPEG',
        );

        expect(result.keptOriginal).toBe(false);
        expect(result.blob.size).toBe(400);
        expect(result.format).toBe(OutputFormat.Png);
    });
});

describe('runFit', () => {
    it('searches at the requested size and returns the quality it found', async () => {
        vi.mocked(fitToFilesize).mockResolvedValue({
            data: new Uint8Array(400),
            quality: 62,
        });

        const quality = await runFit(new Uint8Array(1000), {
            width: 800,
            height: 600,
            targetBytes: 500 * 1024,
        });

        expect(quality).toBe(62);
        expect(fitToFilesize).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ width: 800, height: 600 }),
        );
    });
});
