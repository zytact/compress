import { OutputFormat, formatBytes } from './wasm';
import type { CompressionSettings } from './compress';

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
    originalFormat: string | null;
    settings: CompressionSettings;
}

/** Below this there is no honest target left to suggest. */
const SMALLEST_USEFUL_TARGET_KB = 2;

const toKb = (bytes: number) => Math.floor(bytes / 1024);

const formatLabel = (format: OutputFormat) =>
    format === OutputFormat.Png ? 'PNG' : 'JPEG';

/** Advice for reaching a size under `originalSize` via the target field. */
function targetAdvice(originalSize: number, prefix: string): string {
    const kb = toKb(originalSize);
    return kb < SMALLEST_USEFUL_TARGET_KB
        ? 'A file this small has almost nothing left to give.'
        : `${prefix} ${kb} KB. Quality stops dropping at 30, so a very small target can still come up short.`;
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
        settings.mode === 'dimensions' &&
        settings.format !== OutputFormat.Original &&
        settings.format !== outputFormat
            ? formatLabel(settings.format)
            : null;

    // HEIC is decoded to JPEG before compression and JPEG needs more bytes for
    // the same picture, so it is the one source with no smaller fallback.
    if (originalFormat?.toUpperCase() === 'HEIC' && outputSize > originalSize) {
        return {
            tone: 'warning',
            message: `HEIC fits more into fewer bytes than JPEG can, so this JPEG is ${formatBytes(outputSize)}, larger than your ${formatBytes(originalSize)} original.${dropped ? ` The ${dropped} you picked would be larger still.` : ''}`,
            advice:
                settings.mode === 'filesize'
                    ? targetAdvice(originalSize, 'Lower the target below')
                    : targetAdvice(
                          originalSize,
                          'Switch to By File Size and ask for less than',
                      ),
        };
    }

    if (!keptOriginal) return null;

    if (settings.mode === 'filesize') {
        return {
            tone: 'neutral',
            message: `This is already ${formatBytes(originalSize)}, under your ${settings.targetKb} KB target, so we left it alone.`,
            advice: targetAdvice(originalSize, 'Lower the target below'),
        };
    }

    return {
        tone: 'neutral',
        message: dropped
            ? `Your original is already well compressed. Saving it as ${dropped} at these settings would make it bigger, so we kept your original ${formatLabel(outputFormat)}.`
            : 'Your original is already well compressed. Saving it at these settings would make it bigger, so we kept the original.',
        advice: `Lower the quality below ${settings.quality}%, or the dimensions below ${settings.width} x ${settings.height}.`,
    };
}
