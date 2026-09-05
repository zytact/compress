import { OutputFormat, formatBytes } from './wasm';
import { FIT_QUALITY_CEIL, FIT_QUALITY_FLOOR, usesQuality } from './compress';
import type { CompressionSettings } from './compress';
import type { SourceFormat } from './wasm';

/**
 * Explains why a pass did not save anything, and which on-screen control to
 * reach for next. `null` means the pass did save bytes and the UI should show
 * the reduction instead.
 */
export interface CompressionNotice {
    tone: 'neutral' | 'warning';
    message: string;
    advice: string;
}

interface NoticeInput {
    /** The source was returned unchanged because encoding could not beat it. */
    keptOriginal: boolean;
    /** Format of the returned file, which is the source's own when kept. */
    outputFormat: OutputFormat;
    outputSize: number;
    /** Size of the file the user picked, which is what they compare against. */
    originalSize: number;
    /** Format of the picked file, before any HEIC conversion. */
    originalFormat: SourceFormat | null;
    settings: CompressionSettings;
}

/** A source this small rounds to a target no one can ask for a KB under. */
const SMALLEST_USEFUL_TARGET_KB = 2;

const toKb = (bytes: number) => Math.floor(bytes / 1024);

const formatLabel = (format: OutputFormat) =>
    format === OutputFormat.Png ? 'PNG' : 'JPEG';

/** Advice for reaching a size under `originalSize` via the target field. */
function targetAdvice(originalSize: number): string {
    const kb = toKb(originalSize);
    return kb < SMALLEST_USEFUL_TARGET_KB
        ? `This file is already under ${SMALLEST_USEFUL_TARGET_KB} KB, so there is no smaller target worth asking for.`
        : `Fit to a size under ${kb} KB. Quality stops dropping at ${FIT_QUALITY_FLOOR}, so a very small target can still come up short.`;
}

export function describeCompression({
    keptOriginal,
    outputFormat,
    outputSize,
    originalSize,
    originalFormat,
    settings,
}: NoticeInput): CompressionNotice | null {
    // An explicit format request that would have cost bytes gets dropped rather
    // than honored, so every message below names the format we kept instead.
    const dropped =
        settings.format !== OutputFormat.Original &&
        settings.format !== outputFormat
            ? formatLabel(settings.format)
            : null;

    // HEIC is decoded to JPEG before compression and JPEG needs more bytes for
    // the same picture, so it is the one source with no smaller fallback.
    if (originalFormat === 'HEIC' && outputSize > originalSize) {
        return {
            tone: 'warning',
            message: `HEIC fits more into fewer bytes than JPEG can, so this JPEG is ${formatBytes(outputSize)}, larger than your ${formatBytes(originalSize)} original.${dropped ? ` The ${dropped} you picked would be larger still.` : ''}`,
            advice: targetAdvice(originalSize),
        };
    }

    if (!keptOriginal) return null;

    const sizeAdvice = `the size below ${settings.width} x ${settings.height}`;

    // A HEIC pick reaches this branch as the JPEG it was decoded to, so calling
    // that the user's original would name a file they never had.
    const kept =
        originalFormat === 'HEIC' ? 'the decoded JPEG' : 'your original';

    return {
        tone: 'neutral',
        message: dropped
            ? `Saving ${kept} as ${dropped} at these settings would not make it any smaller, so we kept the ${formatLabel(outputFormat)}.`
            : `Saving ${kept} at these settings would not make it any smaller, so we kept it unchanged.`,
        advice: usesQuality(settings.format, originalFormat)
            ? `Lower the quality below ${settings.quality}, or ${sizeAdvice}.`
            : `Switch to JPEG to trade detail for bytes, or lower ${sizeAdvice}.`,
    };
}

/** What a target-size search settled on, and the controls it settled it for. */
export interface FitOutcome {
    width: number;
    targetKb: number;
    quality: number;
}

/**
 * Explains a target-size search, or `null` once any control it was solved for
 * has moved, because the answer no longer describes what is on screen.
 */
export function describeFit(
    fit: FitOutcome | null,
    current: FitOutcome,
): string | null {
    if (
        !fit ||
        fit.width !== current.width ||
        fit.targetKb !== current.targetKb ||
        fit.quality !== current.quality
    ) {
        return null;
    }

    if (fit.quality >= FIT_QUALITY_CEIL) {
        return `Quality set to ${fit.quality}. Even at its sharpest this stays under ${fit.targetKb} KB.`;
    }
    if (fit.quality <= FIT_QUALITY_FLOOR) {
        return `Quality set to ${fit.quality}, the lowest this goes. Reduce the width too if it still overshoots ${fit.targetKb} KB.`;
    }
    return `Quality set to ${fit.quality} to land just under ${fit.targetKb} KB.`;
}
