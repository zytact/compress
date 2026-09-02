import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    areSettingsCompressible,
    resolveOutputFormat,
    runCompression,
} from '../compress';
import { OutputFormat, resizeByDimensions, resizeByFilesize } from '../wasm';
import type * as WasmModule from '../wasm';

// The encoders need WASM, so stub them and keep the real format helpers
vi.mock('../wasm', async (importActual) => ({
    ...(await importActual<typeof WasmModule>()),
    resizeByDimensions: vi.fn(),
    resizeByFilesize: vi.fn(),
}));

// jsdom has no createImageBitmap, and these tests only assert byte sizes
vi.stubGlobal('createImageBitmap', () =>
    Promise.resolve({ width: 100, height: 100, close: () => {} }),
);

describe('resolveOutputFormat', () => {
    it('keeps an explicitly requested format', () => {
        expect(resolveOutputFormat(OutputFormat.Png, 'JPEG')).toBe(
            OutputFormat.Png,
        );
    });

    it('resolves Original to the source format', () => {
        expect(resolveOutputFormat(OutputFormat.Original, 'png')).toBe(
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

describe('areSettingsCompressible', () => {
    it('rejects half-typed dimensions', () => {
        expect(
            areSettingsCompressible({
                mode: 'dimensions',
                width: 0,
                height: 1080,
                format: OutputFormat.Jpeg,
                quality: 85,
            }),
        ).toBe(false);
    });

    it('rejects a zero target size', () => {
        expect(areSettingsCompressible({ mode: 'filesize', targetKb: 0 })).toBe(
            false,
        );
    });

    it('accepts usable settings', () => {
        expect(
            areSettingsCompressible({ mode: 'filesize', targetKb: 500 }),
        ).toBe(true);
    });
});

describe('runCompression never returns a larger file', () => {
    const source = new Uint8Array(1000);

    beforeEach(() => {
        vi.mocked(resizeByDimensions).mockReset();
        vi.mocked(resizeByFilesize).mockReset();
    });

    it('keeps a source that is already under the target size', async () => {
        const result = await runCompression(
            source,
            { mode: 'filesize', targetKb: 500 },
            'PNG',
        );

        expect(resizeByFilesize).not.toHaveBeenCalled();
        expect(result.keptOriginal).toBe(true);
        expect(result.blob.size).toBe(source.length);
        expect(result.format).toBe(OutputFormat.Png);
    });

    it('keeps the source when the requested format encodes larger', async () => {
        vi.mocked(resizeByDimensions).mockResolvedValue(new Uint8Array(4000));

        const result = await runCompression(
            source,
            {
                mode: 'dimensions',
                width: 100,
                height: 100,
                format: OutputFormat.Png,
                quality: 85,
            },
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
            {
                mode: 'dimensions',
                width: 100,
                height: 100,
                format: OutputFormat.Png,
                quality: 85,
            },
            'JPEG',
        );

        expect(result.keptOriginal).toBe(false);
        expect(result.blob.size).toBe(400);
        expect(result.format).toBe(OutputFormat.Png);
    });
});
