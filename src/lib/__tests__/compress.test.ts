import { describe, expect, it } from 'vitest';
import { areSettingsCompressible, resolveOutputFormat } from '../compress';
import { OutputFormat } from '../wasm';

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
