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

/**
 * Runs one compression pass and measures the encoded result.
 * Runs inside the worker; call `compress` from `compress-client` instead.
 */
export async function runCompression(
    source: Uint8Array,
    settings: CompressionSettings,
    originalFormat: string | null,
): Promise<CompressionResult> {
    let data: Uint8Array;
    let format: OutputFormat;

    if (settings.mode === 'dimensions') {
        format = resolveOutputFormat(settings.format, originalFormat);
        data = await resizeByDimensions(source, {
            width: settings.width,
            height: settings.height,
            format,
            quality: settings.quality,
        });
    } else {
        format = OutputFormat.Jpeg;
        data = await resizeByFilesize(source, {
            targetBytes: settings.targetKb * 1024,
            floorQuality: 30,
            ceilQuality: 95,
            tolerancePercent: 0,
        });
    }

    const blob = uint8ArrayToBlob(data, getMimeType(format));
    return { blob, format, ...(await measure(blob)) };
}
