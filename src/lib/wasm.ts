// WASM loader and wrapper

import type * as Wasm from '../../public/wasm/image_compress_wasm.js';

type WasmModule = typeof Wasm;

let wasmModule: WasmModule | null = null;
let initPromise: Promise<WasmModule> | null = null;

export enum OutputFormat {
    Jpeg = 0,
    Png = 1,
    Original = 2,
}

export type SourceFormat = 'JPEG' | 'PNG' | 'GIF' | 'WebP' | 'HEIC' | 'unknown';

export interface ImageInfo {
    width: number;
    height: number;
    format: SourceFormat;
    size_bytes: number;
}

/**
 * Image bytes on a buffer this tab owns, which is what backing a `Blob` and
 * transferring between threads both need.
 */
export type ImageBytes = Uint8Array<ArrayBuffer>;

/** Encoded bytes and the size they were encoded at, straight from the encoder. */
export interface EncodedImage {
    data: ImageBytes;
    width: number;
    height: number;
}

/** An encoded image plus the JPEG quality a target-size search settled on. */
export interface FitOutput extends EncodedImage {
    quality: number;
}

export interface EncodeOptions {
    width: number;
    height: number;
    format: OutputFormat;
    quality?: number;
}

export interface FitOptions {
    width: number;
    height: number;
    targetBytes: number;
    floorQuality?: number;
    ceilQuality?: number;
}

/**
 * Initialize the WASM Module
 * Call this once before using any image functions
 */
export async function initWasm(): Promise<WasmModule> {
    if (wasmModule) {
        return wasmModule;
    }

    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        try {
            // Dynamic import of the WASM module
            const wasm =
                await import('../../public/wasm/image_compress_wasm.js');
            await wasm.default();
            wasm.init_panic_hook();
            wasmModule = wasm;
            return wasm;
        } catch (error) {
            initPromise = null;
            throw new Error(
                `Failed to initialize WASM module: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    })();

    return initPromise;
}

/** What a compression pass needs from a decoded source. */
export interface DecodedSource {
    /** The bytes the user picked, kept for the never-grow fallback. */
    readonly bytes: ImageBytes;
    readonly width: number;
    readonly height: number;
    readonly byteLength: number;
    encode: (options: EncodeOptions) => EncodedImage;
    fit: (options: FitOptions) => FitOutput;
}

/**
 * One decoded image, encoded as many times as the user edits it.
 *
 * The WASM side holds the decoded pixels and the last size they were resized
 * to, so changing only the quality re-encodes without decoding or resizing
 * again. Create one per image the user picks and `free()` it when they pick
 * another.
 */
export class ImageSource implements DecodedSource {
    private constructor(
        private readonly handle: Wasm.ImageSource,
        readonly bytes: ImageBytes,
    ) {}

    static async create(bytes: ImageBytes): Promise<ImageSource> {
        const wasm = await initWasm();
        try {
            return new ImageSource(new wasm.ImageSource(bytes), bytes);
        } catch (error) {
            throw new Error(`Failed to decode image: ${describe(error)}`);
        }
    }

    get width(): number {
        return this.handle.width;
    }

    get height(): number {
        return this.handle.height;
    }

    get byteLength(): number {
        return this.bytes.length;
    }

    encode(options: EncodeOptions): EncodedImage {
        let result;
        try {
            result = this.handle.encode(
                options.width,
                options.height,
                options.format,
                options.quality,
            );
        } catch (error) {
            throw new Error(`Failed to resize image: ${describe(error)}`);
        }

        try {
            return read(result);
        } finally {
            result.free();
        }
    }

    /**
     * Encode at the highest JPEG quality that still fits under a target size.
     *
     * Resizes to `width` x `height` first, so a target size and a target width
     * can be asked for together.
     */
    fit(options: FitOptions): FitOutput {
        let result;
        try {
            result = this.handle.fit_to_filesize(
                options.width,
                options.height,
                options.targetBytes,
                options.floorQuality,
                options.ceilQuality,
            );
        } catch (error) {
            throw new Error(
                `Failed to fit image to target size: ${describe(error)}`,
            );
        }

        try {
            return { ...read(result), quality: result.quality };
        } finally {
            result.free();
        }
    }

    free(): void {
        this.handle.free();
    }
}

const describe = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

/**
 * Copies an encoded result out of WASM memory, which the caller frees straight
 * after. The bytes land on a fresh buffer this tab owns, never shared memory,
 * which is why the narrowing below holds.
 */
function read(result: Wasm.EncodedImage | Wasm.FitResult): EncodedImage {
    return {
        data: result.data as ImageBytes,
        width: result.width,
        height: result.height,
    };
}

/**
 * Convert a File or Blob to Uint8Array
 */
export async function fileToUint8Array(file: Blob): Promise<ImageBytes> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(new Uint8Array(reader.result));
            } else {
                reject(new Error('Failed to read file as ArrayBuffer'));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Convert HEIC/HEIF to JPEG using browser's native decoding (on supported devices)
 * Uses capability-based detection to check if browser supports HEIC
 */
export async function convertHeicToJpeg(
    file: File,
    quality: number = 0.95,
): Promise<Blob> {
    try {
        // Try createImageBitmap first (fast path for modern browsers)
        try {
            const imageBitmap = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            canvas.width = imageBitmap.width;
            canvas.height = imageBitmap.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Failed to get canvas context');
            }
            ctx.drawImage(imageBitmap, 0, 0);
            imageBitmap.close();

            return new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(
                                new Error('Failed to convert canvas to blob'),
                            );
                        }
                    },
                    'image/jpeg',
                    quality,
                );
            });
        } catch (bitmapError) {
            // Fallback to HTMLImageElement
            const url = URL.createObjectURL(file);
            try {
                const img = await new Promise<HTMLImageElement>(
                    (resolve, reject) => {
                        const image = new Image();
                        image.onload = () => resolve(image);
                        image.onerror = () =>
                            reject(
                                new Error(
                                    'Browser cannot decode HEIC. Please use Safari or convert to JPEG/PNG.',
                                ),
                            );
                        image.src = url;
                    },
                );

                // Draw to canvas and convert to JPEG
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    throw new Error('Failed to get canvas context');
                }
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);

                return new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(
                                    new Error(
                                        'Failed to convert canvas to blob',
                                    ),
                                );
                            }
                        },
                        'image/jpeg',
                        quality,
                    );
                });
            } catch (imgError) {
                URL.revokeObjectURL(url);
                throw imgError;
            }
        }
    } catch (error) {
        throw new Error(
            `HEIC conversion failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Get image dimensions from browser using Image element
 */
export async function getImageDimensionsFromUrl(
    url: string,
): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
    });
}

/**
 * Infer format from file extension
 */
export function inferFormatFromFilename(filename: string): SourceFormat {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
        case 'jpg':
        case 'jpeg':
            return 'JPEG';
        case 'png':
            return 'PNG';
        case 'gif':
            return 'GIF';
        case 'webp':
            return 'WebP';
        case 'heic':
        case 'heif':
            return 'HEIC';
        default:
            return 'unknown';
    }
}

/**
 * Convert Uint8Array to Blob for download/preview
 */
export function uint8ArrayToBlob(
    data: ImageBytes,
    mimeType: string = 'image/jpeg',
): Blob {
    return new Blob([data], { type: mimeType });
}

/**
 * Get MIME type from OutputFormat
 */
export function getMimeType(format: OutputFormat): string {
    switch (format) {
        case OutputFormat.Jpeg:
            return 'image/jpeg';
        case OutputFormat.Png:
            return 'image/png';
        default:
            return 'image/jpeg';
    }
}

/**
 * Get file extension from OutputFormat
 */
export function getFileExtension(format: OutputFormat): string {
    switch (format) {
        case OutputFormat.Jpeg:
            return 'jpg';
        case OutputFormat.Png:
            return 'png';
        default:
            return 'jpg';
    }
}

/**
 * Replace file extension in filename
 */
export function replaceFileExtension(
    filename: string,
    newExtension: string,
): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
        // No extension found, append new extension
        return `${filename}.${newExtension}`;
    }
    // Replace existing extension
    return filename.substring(0, lastDotIndex) + `.${newExtension}`;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
