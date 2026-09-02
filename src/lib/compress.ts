import {
    OutputFormat,
    getMimeType,
    resizeByDimensions,
    resizeByFilesize,
    uint8ArrayToBlob,
} from './wasm';

export type CompressionSettings =
    | {
          mode: 'dimensions';
          width: number;
          height: number;
          format: OutputFormat;
          quality: number;
      }
    | { mode: 'filesize'; targetKb: number };

export interface CompressionResult {
    blob: Blob;
    format: OutputFormat;
    width: number;
    height: number;
    /** The source was kept because encoding it would not have made it smaller. */
    keptOriginal: boolean;
}

/**
 * Resolves `OutputFormat.Original` against the source image's own format.
 * HEIC sources are already converted to JPEG before compression, so they
 * resolve to JPEG along with every format the WASM encoder cannot emit.
 */
export function resolveOutputFormat(
    requested: OutputFormat,
    originalFormat: string | null,
): OutputFormat {
    if (requested !== OutputFormat.Original) return requested;
    return originalFormat?.toUpperCase() === 'PNG'
        ? OutputFormat.Png
        : OutputFormat.Jpeg;
}

/** Settings that cannot produce an image are skipped while the user types. */
export function areSettingsCompressible(
    settings: CompressionSettings,
): boolean {
    return settings.mode === 'dimensions'
        ? settings.width > 0 && settings.height > 0
        : settings.targetKb > 0;
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
 * never larger than the input. That overrides a requested format or size when
 * honoring it would cost bytes; `keptOriginal` tells the UI to say so.
 *
 * Runs inside the worker; call `compress` from `compress-client` instead.
 */
export async function runCompression(
    source: Uint8Array,
    settings: CompressionSettings,
    originalFormat: string | null,
): Promise<CompressionResult> {
    // HEIC is converted to JPEG before it reaches here, so the source bytes are
    // always JPEG or PNG and this describes them exactly.
    const sourceFormat = resolveOutputFormat(
        OutputFormat.Original,
        originalFormat,
    );
    const keepSource = () => finalize(source, sourceFormat, true);

    if (settings.mode === 'filesize') {
        // Already under target, so re-encoding could only add bytes
        if (source.length <= settings.targetKb * 1024) return keepSource();

        const data = await resizeByFilesize(source, {
            targetBytes: settings.targetKb * 1024,
            floorQuality: 30,
            ceilQuality: 95,
            tolerancePercent: 0,
        });
        return data.length < source.length
            ? finalize(data, OutputFormat.Jpeg, false)
            : keepSource();
    }

    const format = resolveOutputFormat(settings.format, originalFormat);
    const data = await resizeByDimensions(source, {
        width: settings.width,
        height: settings.height,
        format,
        quality: settings.quality,
    });
    return data.length < source.length
        ? finalize(data, format, false)
        : keepSource();
}
