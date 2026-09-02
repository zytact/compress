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

const keptPng = {
    keptOriginal: true,
    outputFormat: OutputFormat.Png,
    outputSize: 1000,
    originalSize: 1000,
    originalFormat: 'PNG',
} as const;

/** A HEIC that decoded to a JPEG larger than the file the user picked. */
const grownHeic = {
    keptOriginal: true,
    outputFormat: OutputFormat.Jpeg,
    outputSize: 4 * 1024 * 1024,
    originalSize: 2 * 1024 * 1024,
    originalFormat: 'HEIC',
} as const;

describe('describeCompression', () => {
    it('stays quiet when the pass actually saved bytes', () => {
        expect(
            describeCompression({
                keptOriginal: false,
                outputFormat: OutputFormat.Jpeg,
                outputSize: 400,
                originalSize: 1000,
                originalFormat: 'JPEG',
                settings: dimensions,
            }),
        ).toBeNull();
    });

    it('points at the target field when the file is already under it', () => {
        const notice = describeCompression({
            keptOriginal: true,
            outputFormat: OutputFormat.Jpeg,
            outputSize: 300 * 1024,
            originalSize: 300 * 1024,
            originalFormat: 'JPEG',
            settings: { mode: 'filesize', targetKb: 500 },
        });

        expect(notice?.tone).toBe('neutral');
        expect(notice?.message).toContain('under your 500 KB target');
    });

    it('suggests no target for a file too small to have one', () => {
        const notice = describeCompression({
            ...keptPng,
            outputSize: 1568,
            originalSize: 1568,
            settings: { mode: 'filesize', targetKb: 500 },
        });

        expect(notice?.advice).toBe(
            'A file this small has almost nothing left to give.',
        );
    });

    it('names the dropped format and the live control values', () => {
        const notice = describeCompression({
            ...keptPng,
            settings: dimensions,
        });

        expect(notice?.tone).toBe('neutral');
        expect(notice?.message).toContain('as JPEG');
        expect(notice?.message).toContain('your original PNG');
        expect(notice?.advice).toBe(
            'Lower the quality below 85%, or the dimensions below 100 x 100.',
        );
    });

    it('warns and names a target when a HEIC grew', () => {
        const notice = describeCompression({
            ...grownHeic,
            settings: dimensions,
        });

        expect(notice?.tone).toBe('warning');
        expect(notice?.advice).toContain(
            'Switch to By File Size and ask for less than 2048 KB',
        );
    });

    it('does not tell a filesize-mode user to switch to filesize mode', () => {
        const notice = describeCompression({
            ...grownHeic,
            settings: { mode: 'filesize', targetKb: 5000 },
        });

        expect(notice?.tone).toBe('warning');
        expect(notice?.advice).toContain('Lower the target below 2048 KB');
        expect(notice?.advice).not.toContain('Switch to');
    });

    it('says a dropped PNG would have been larger still on a grown HEIC', () => {
        const notice = describeCompression({
            ...grownHeic,
            settings: { ...dimensions, format: OutputFormat.Png },
        });

        expect(notice?.message).toContain('The PNG you picked would be larger');
    });
});
