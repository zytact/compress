import {
    OutputFormat,
    fitToFilesize,
    getMimeType,
    resizeByDimensions,
    uint8ArrayToBlob,
} from './wasm';
import type { SourceFormat } from './wasm';

export interface CompressionSettings {
    width: number;
    height: number;
    format: OutputFormat;
    quality: number;
}

export interface FitRequest {
    width: number;
    height: number;
    targetBytes: number;
}

export interface CompressionResult {
    blob: Blob;
    format: OutputFormat;
    width: number;
    height: number;
    /** The source was kept because encoding it would not have made it smaller. */
    keptOriginal: boolean;
}

export const FIT_QUALITY_FLOOR = 30;
export const FIT_QUALITY_CEIL = 95;

/**
 * Resolves `OutputFormat.Original` against the source image's own format.
 * HEIC sources are already converted to JPEG before compression, so they
 * resolve to JPEG along with every format the WASM encoder cannot emit.
 */
export function resolveOutputFormat(
    requested: OutputFormat,
    originalFormat: SourceFormat | null,
): OutputFormat {
    if (requested !== OutputFormat.Original) return requested;
    return originalFormat === 'PNG' ? OutputFormat.Png : OutputFormat.Jpeg;
}

export function usesQuality(
    format: OutputFormat,
    originalFormat: SourceFormat | null,
): boolean {
    return resolveOutputFormat(format, originalFormat) === OutputFormat.Jpeg;
}

/** Settings that cannot produce an image are skipped while the user types. */
export function areSettingsCompressible(
    settings: CompressionSettings,
): boolean {
    return settings.width > 0 && settings.height > 0;
}

async function measure(blob: Blob): Promise<{ width: number; height: number }> {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    bitmap.close();
    return { width, height };
}

async function finalize(
    data: Uint8Array,
    format: OutputFormat,
    keptOriginal: boolean,
): Promise<CompressionResult> {
    const blob = uint8ArrayToBlob(data, getMimeType(format));
    return { blob, format, keptOriginal, ...(await measure(blob)) };
}

/**
 * Runs one compression pass and measures the encoded result.
 *
 * The source is kept whenever encoding would not beat it, so the output is
 * never larger than the input. That overrides a requested format when honoring
 * it would cost bytes; `keptOriginal` tells the UI to say so.
 *
 * Runs inside the worker; call `compress` from `compress-client` instead.
 */
export async function runCompression(
    source: Uint8Array,
    settings: CompressionSettings,
    originalFormat: SourceFormat | null,
): Promise<CompressionResult> {
    const format = resolveOutputFormat(settings.format, originalFormat);
    const data = await resizeByDimensions(source, {
        width: settings.width,
        height: settings.height,
        format,
        quality: settings.quality,
    });

    if (data.length < source.length) return finalize(data, format, false);

    // HEIC is converted to JPEG before it reaches here, so the source bytes are
    // always JPEG or PNG and this describes them exactly.
    const sourceFormat = resolveOutputFormat(
        OutputFormat.Original,
        originalFormat,
    );
    return finalize(source, sourceFormat, true);
}

export async function runFit(
    source: Uint8Array,
    request: FitRequest,
): Promise<number> {
    const { quality } = await fitToFilesize(source, {
        ...request,
        floorQuality: FIT_QUALITY_FLOOR,
        ceilQuality: FIT_QUALITY_CEIL,
    });
    return quality;
}
