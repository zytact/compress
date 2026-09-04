import { describe, expect, it, vi } from 'vitest';
import {
    areSettingsCompressible,
    resolveOutputFormat,
    runCompression,
    runFit,
    sameSettings,
    usesQuality,
} from '../compress';
import { OutputFormat } from '../wasm';
import type {
    DecodedSource,
    EncodeOptions,
    FitOptions,
    ImageBytes,
} from '../wasm';

const settings = {
    width: 100,
    height: 100,
    format: OutputFormat.Jpeg,
    quality: 85,
};

const bytes = (length: number): ImageBytes =>
    new Uint8Array(new ArrayBuffer(length));

/** A decoded source that hands back whatever bytes the test wants encoded. */
function stubSource(
    sourceBytes: number,
    encode: (options: EncodeOptions) => ImageBytes,
    fit: (options: FitOptions) => {
        data: ImageBytes;
        quality: number;
    } = () => {
        throw new Error('fit was not expected');
    },
): DecodedSource {
    return {
        bytes: bytes(sourceBytes),
        byteLength: sourceBytes,
        width: 800,
        height: 600,
        encode: (options) => ({
            data: encode(options),
            width: options.width,
            height: options.height,
        }),
        fit: (options) => ({
            ...fit(options),
            width: options.width,
            height: options.height,
        }),
    };
}

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

describe('sameSettings', () => {
    it('sees through a fresh object with the same values', () => {
        expect(sameSettings(settings, { ...settings })).toBe(true);
    });

    it('separates settings that would encode differently', () => {
        expect(sameSettings(settings, { ...settings, quality: 84 })).toBe(
            false,
        );
        expect(
            sameSettings(settings, { ...settings, format: OutputFormat.Png }),
        ).toBe(false);
    });
});

describe('runCompression never returns a larger file', () => {
    it('keeps the source when the requested format encodes larger', () => {
        const source = stubSource(1000, () => bytes(4000));

        const result = runCompression(
            source,
            { ...settings, format: OutputFormat.Png },
            'JPEG',
        );

        expect(result.keptOriginal).toBe(true);
        expect(result.blob.size).toBe(1000);
        expect(result.format).toBe(OutputFormat.Jpeg);
        // The kept source is the whole picture, not the requested size
        expect(result.width).toBe(800);
        expect(result.height).toBe(600);
    });

    it('uses the encoded result when it is smaller', () => {
        const source = stubSource(1000, () => bytes(400));

        const result = runCompression(
            source,
            { ...settings, format: OutputFormat.Png },
            'JPEG',
        );

        expect(result.keptOriginal).toBe(false);
        expect(result.blob.size).toBe(400);
        expect(result.format).toBe(OutputFormat.Png);
        expect(result.width).toBe(100);
        expect(result.height).toBe(100);
    });
});

describe('runFit', () => {
    it('returns the image the search already encoded', () => {
        const fit = vi.fn(() => ({ data: bytes(400), quality: 62 }));
        const source = stubSource(1000, () => bytes(400), fit);

        const result = runFit(
            source,
            { width: 800, height: 600, targetBytes: 500 * 1024 },
            'JPEG',
        );

        expect(result.quality).toBe(62);
        expect(result.blob.size).toBe(400);
        expect(result.keptOriginal).toBe(false);
        expect(fit).toHaveBeenCalledWith(
            expect.objectContaining({ width: 800, height: 600 }),
        );
    });

    it('still keeps a source the search could not beat', () => {
        const source = stubSource(
            1000,
            () => bytes(400),
            () => ({ data: bytes(4000), quality: 30 }),
        );

        const result = runFit(
            source,
            { width: 800, height: 600, targetBytes: 1024 },
            'JPEG',
        );

        expect(result.keptOriginal).toBe(true);
        expect(result.quality).toBe(30);
        expect(result.blob.size).toBe(1000);
    });
});
