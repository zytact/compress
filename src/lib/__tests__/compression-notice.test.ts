import { describe, expect, it } from 'vitest';
import { describeCompression, describeFit } from '../compression-notice';
import { OutputFormat } from '../wasm';

const settings = {
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
                settings,
            }),
        ).toBeNull();
    });

    it('names the dropped format and the live control values', () => {
        const notice = describeCompression({ ...keptPng, settings });

        expect(notice?.tone).toBe('neutral');
        expect(notice?.message).toContain('as JPEG');
        expect(notice?.message).toContain('we kept the PNG');
        expect(notice?.advice).toBe(
            'Lower the quality below 85, or the size below 100 x 100.',
        );
    });

    it('never sends a PNG user to the hidden quality control', () => {
        const notice = describeCompression({
            ...keptPng,
            outputFormat: OutputFormat.Jpeg,
            originalFormat: 'JPEG',
            settings: { ...settings, format: OutputFormat.Png },
        });

        expect(notice?.advice).toBe(
            'Switch to JPEG to trade detail for bytes, or lower the size below 100 x 100.',
        );
    });

    it('does not name a dropped format when none was dropped', () => {
        const notice = describeCompression({
            ...keptPng,
            settings: { ...settings, format: OutputFormat.Png },
        });

        expect(notice?.message).not.toContain('JPEG');
    });

    it('warns and names a target when a HEIC grew', () => {
        const notice = describeCompression({ ...grownHeic, settings });

        expect(notice?.tone).toBe('warning');
        expect(notice?.advice).toContain('Fit to a size under 2048 KB');
    });

    it('suggests no target for a file too small to have one', () => {
        const notice = describeCompression({
            ...grownHeic,
            outputSize: 1600,
            originalSize: 1568,
            settings,
        });

        expect(notice?.advice).toBe(
            'This file is already under 2 KB, so there is no smaller target worth asking for.',
        );
    });

    it('says a dropped PNG would have been larger still on a grown HEIC', () => {
        const notice = describeCompression({
            ...grownHeic,
            settings: { ...settings, format: OutputFormat.Png },
        });

        expect(notice?.message).toContain('The PNG you picked would be larger');
    });
});

describe('describeFit', () => {
    const solved = { width: 1200, targetKb: 120, quality: 62 };

    it('explains the quality the search settled on', () => {
        expect(describeFit(solved, solved)).toBe(
            'Quality set to 62 to land just under 120 KB.',
        );
    });

    it('goes quiet once any control it was solved for has moved', () => {
        expect(describeFit(solved, { ...solved, width: 2400 })).toBeNull();
        expect(describeFit(solved, { ...solved, targetKb: 500 })).toBeNull();
        expect(describeFit(solved, { ...solved, quality: 63 })).toBeNull();
    });

    it('admits when it ran out of room at the quality floor', () => {
        const note = describeFit(
            { ...solved, quality: 30 },
            { ...solved, quality: 30 },
        );

        expect(note).toContain('the lowest this goes');
        expect(note).toContain('Reduce the width');
    });

    it('says there was room to spare at the ceiling', () => {
        const note = describeFit(
            { ...solved, quality: 95 },
            { ...solved, quality: 95 },
        );

        expect(note).toContain('Even at its sharpest');
    });
});
