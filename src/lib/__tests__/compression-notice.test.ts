import { describe, expect, it } from 'vitest';
import { describeCompression } from '../compression-notice';
import { OutputFormat } from '../wasm';

const dimensions = {
    mode: 'dimensions',
    width: 100,
    height: 100,
    format: OutputFormat.Jpeg,
    quality: 85,
} as const;

describe('describeCompression', () => {
    it('stays quiet when the pass actually saved bytes', () => {
        expect(
            describeCompression({
                keptOriginal: false,
                outputFormat: OutputFormat.Jpeg,
                outputSize: 400,
                originalSize: 1000,
                settings: dimensions,
            }),
        ).toBeNull();
    });

    it('warns and names a target when the output beats nothing', () => {
        const notice = describeCompression({
            keptOriginal: false,
            outputFormat: OutputFormat.Jpeg,
            outputSize: 4 * 1024 * 1024,
            originalSize: 2 * 1024 * 1024,
            settings: dimensions,
        });

        expect(notice?.tone).toBe('warning');
        expect(notice?.advice).toContain('less than 2048 KB');
    });

    it('points at the target slider when the file is already under it', () => {
        const notice = describeCompression({
            keptOriginal: true,
            outputFormat: OutputFormat.Jpeg,
            outputSize: 300 * 1024,
            originalSize: 300 * 1024,
            settings: { mode: 'filesize', targetKb: 500 },
        });

        expect(notice?.tone).toBe('neutral');
        expect(notice?.message).toContain('under your 500 KB target');
    });

    it('points at quality and dimensions when the encoder cannot win', () => {
        const notice = describeCompression({
            keptOriginal: true,
            outputFormat: OutputFormat.Png,
            outputSize: 1000,
            originalSize: 1000,
            settings: dimensions,
        });

        expect(notice?.tone).toBe('neutral');
        expect(notice?.advice).toContain('quality');
    });

    it('names both formats when it kept one the user did not pick', () => {
        const notice = describeCompression({
            keptOriginal: true,
            outputFormat: OutputFormat.Png,
            outputSize: 1000,
            originalSize: 1000,
            settings: dimensions,
        });

        expect(notice?.message).toContain('as JPEG');
        expect(notice?.message).toContain('your original PNG');
    });

    it('suggests no target for a file too small to have one', () => {
        const notice = describeCompression({
            keptOriginal: true,
            outputFormat: OutputFormat.Png,
            outputSize: 1568,
            originalSize: 1568,
            settings: { mode: 'filesize', targetKb: 500 },
        });

        expect(notice?.advice).toBe(
            'A file this small has almost nothing left to give.',
        );
    });
});
