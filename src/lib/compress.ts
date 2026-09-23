import { OutputFormat, getMimeType, uint8ArrayToBlob } from './wasm';
import { coversSource, sameCrop } from './crop';
import type { CropRect } from './crop';
import type { DecodedSource, EncodedImage, SourceFormat } from './wasm';

export interface CompressionSettings {
    /** Region of the source to keep, scaled to `width` x `height`. */
    crop: CropRect;
    width: number;
    height: number;
    format: OutputFormat;
    quality: number;
}

export interface FitRequest {
    crop: CropRect;
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

/** A compression result plus the quality the target-size search settled on. */
export interface FitResult extends CompressionResult {
    quality: number;
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
    return (
        settings.width > 0 &&
        settings.height > 0 &&
        settings.crop.width > 0 &&
        settings.crop.height > 0
    );
}

/** Whether two settings would produce the same file, so one result covers both. */
export function sameSettings(
    a: CompressionSettings,
    b: CompressionSettings,
): boolean {
    return (
        sameCrop(a.crop, b.crop) &&
        a.width === b.width &&
        a.height === b.height &&
        a.format === b.format &&
        a.quality === b.quality
    );
}

/**
 * Returns whichever is smaller: the freshly encoded image, or the untouched
 * source.
 *
 * The output is therefore never larger than the input. That overrides a
 * requested format when honoring it would cost bytes; `keptOriginal` tells the
 * UI to say so. A cropped image always wins, since the source is not the
 * picture the user framed.
 */
function keepSmaller(
    source: DecodedSource,
    encoded: EncodedImage,
    crop: CropRect,
    format: OutputFormat,
    originalFormat: SourceFormat | null,
): CompressionResult {
    if (
        encoded.data.length < source.byteLength ||
        !coversSource(crop, source.width, source.height)
    ) {
        return {
            blob: uint8ArrayToBlob(encoded.data, getMimeType(format)),
            format,
            width: encoded.width,
            height: encoded.height,
            keptOriginal: false,
        };
    }

    // HEIC is converted to JPEG before it reaches here, so the source bytes are
    // always JPEG or PNG and this describes them exactly.
    const sourceFormat = resolveOutputFormat(
        OutputFormat.Original,
        originalFormat,
    );
    return {
        blob: uint8ArrayToBlob(source.bytes, getMimeType(sourceFormat)),
        format: sourceFormat,
        width: source.width,
        height: source.height,
        keptOriginal: true,
    };
}

/**
 * Runs one compression pass over an already decoded source.
 *
 * Runs inside the worker; call `compress` from `compress-client` instead.
 */
export function runCompression(
    source: DecodedSource,
    settings: CompressionSettings,
    originalFormat: SourceFormat | null,
): CompressionResult {
    const format = resolveOutputFormat(settings.format, originalFormat);
    const encoded = source.encode({
        crop: settings.crop,
        width: settings.width,
        height: settings.height,
        format,
        quality: settings.quality,
    });

    return keepSmaller(source, encoded, settings.crop, format, originalFormat);
}

/**
 * Searches for the quality that lands just under a target size, and returns the
 * image that search already encoded so the UI never has to encode it again.
 */
export function runFit(
    source: DecodedSource,
    request: FitRequest,
    originalFormat: SourceFormat | null,
): FitResult {
    const output = source.fit({
        ...request,
        floorQuality: FIT_QUALITY_FLOOR,
        ceilQuality: FIT_QUALITY_CEIL,
    });

    return {
        ...keepSmaller(
            source,
            output,
            request.crop,
            OutputFormat.Jpeg,
            originalFormat,
        ),
        quality: output.quality,
    };
}
