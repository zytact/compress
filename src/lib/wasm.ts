// WASM loader and wrapper

type WasmModule = any; // Dynamic import

let wasmModule: WasmModule | null = null;
let initPromise: Promise<WasmModule> | null = null;

export enum OutputFormat {
    Jpeg = 0,
    Png = 1,
    Original = 2,
}

export interface ImageInfo {
    width: number;
    height: number;
    format: string;
    size_bytes: number;
}

export interface ResizeByDimensionsOptions {
    width: number;
    height: number;
    format: OutputFormat;
    quality?: number;
}

export interface ResizeByFilesizeOptions {
    targetBytes: number;
    floorQuality?: number;
    ceilQuality?: number;
    tolerancePercent?: number;
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

/**
 * Resize image by dimensions
 */
export async function resizeByDimensions(
    imageData: Uint8Array,
    options: ResizeByDimensionsOptions,
): Promise<Uint8Array> {
    const wasm = await initWasm();

    try {
        const result = wasm.resize_by_dimensions(
            imageData,
            options.width,
            options.height,
            options.format,
            options.quality,
        );
        return new Uint8Array(result);
    } catch (error) {
        throw new Error(
            `Failed to resize image: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Resize image to target file size
 * Uses binary search on JPEG quality
 */
export async function resizeByFilesize(
    imageData: Uint8Array,
    options: ResizeByFilesizeOptions,
): Promise<Uint8Array> {
    const wasm = await initWasm();

    try {
        const result = wasm.resize_by_filesize(
            imageData,
            options.targetBytes,
            options.floorQuality,
            options.ceilQuality,
            options.tolerancePercent,
        );
        return new Uint8Array(result);
    } catch (error) {
        throw new Error(
            `Failed to resize image to target size: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Convert File to Uint8Array
 */
export async function fileToUint8Array(file: File): Promise<Uint8Array> {
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
 * Convert HEIC/HEIF to JPEG using browser's native decoding (Safari-only)
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
export function inferFormatFromFilename(filename: string): string {
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
    data: Uint8Array,
    mimeType: string = 'image/jpeg',
): Blob {
    return new Blob([new Uint8Array(data)], { type: mimeType });
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
