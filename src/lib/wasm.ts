// WASM loader and wrapper

type WasmModule = any // Dynamic import

let wasmModule: WasmModule | null = null
let initPromise: Promise<WasmModule> | null = null

export enum OutputFormat {
    Jpeg = 0,
    Png = 1,
    Original = 2,
}

export interface ImageInfo {
    width: number
    height: number
    format: string
    size_bytes: number
}

export interface ResizeByDimensionsOptions {
    width: number
    height: number
    format: OutputFormat
    quality?: number
}

export interface ResizeByFilesizeOptions {
    targetBytes: number
    floorQuality?: number
    ceilQuality?: number
    tolerancePercent?: number
}

/**
 * Initialize the WASM Module
 * Call this once before using any image functions
 */
export async function initWasm(): Promise<WasmModule> {
    if (wasmModule) {
        return wasmModule
    }

    if (initPromise) {
        return initPromise
    }

    initPromise = (async () => {
        try {
            // Dynamic import of the WASM module
            const wasm =
                await import('../../public/wasm/image_compress_wasm.js')
            await wasm.default()
            wasm.init_panic_hook()
            wasmModule = wasm
            return wasm
        } catch (error) {
            initPromise = null
            throw new Error(
                `Failed to initialize WASM module: ${error instanceof Error ? error.message : String(error)}`,
            )
        }
    })()

    return initPromise
}

/**
 * Resize image by dimensions
 */
export async function resizeByDimensions(
    imageData: Uint8Array,
    options: ResizeByDimensionsOptions,
): Promise<Uint8Array> {
    const wasm = await initWasm()

    try {
        const result = wasm.resize_by_dimensions(
            imageData,
            options.width,
            options.height,
            options.format,
            options.quality,
        )
        return new Uint8Array(result)
    } catch (error) {
        throw new Error(
            `Failed to resize image: ${error instanceof Error ? error.message : String(error)}`,
        )
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
    const wasm = await initWasm()

    try {
        const result = wasm.resize_by_filesize(
            imageData,
            options.targetBytes,
            options.floorQuality,
            options.ceilQuality,
            options.tolerancePercent,
        )
        return new Uint8Array(result)
    } catch (error) {
        throw new Error(
            `Failed to resize image to target size: ${error instanceof Error ? error.message : String(error)}`,
        )
    }
}

/**
 * Convert File to Uint8Array
 */
export async function fileToUint8Array(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(new Uint8Array(reader.result))
            } else {
                reject(new Error('Failed to read file as ArrayBuffer'))
            }
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsArrayBuffer(file)
    })
}

/**
 * Get image dimensions from browser using Image element
 */
export async function getImageDimensionsFromUrl(
    url: string,
): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight })
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = url
    })
}

/**
 * Infer format from file extension
 */
export function inferFormatFromFilename(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop()
    switch (ext) {
        case 'jpg':
        case 'jpeg':
            return 'JPEG'
        case 'png':
            return 'PNG'
        case 'gif':
            return 'GIF'
        case 'webp':
            return 'WebP'
        default:
            return 'unknown'
    }
}

/**
 * Convert Uint8Array to Blob for download/preview
 */
export function uint8ArrayToBlob(
    data: Uint8Array,
    mimeType: string = 'image/jpeg',
): Blob {
    return new Blob([new Uint8Array(data)], { type: mimeType })
}

/**
 * Get MIME type from OutputFormat
 */
export function getMimeType(format: OutputFormat): string {
    switch (format) {
        case OutputFormat.Jpeg:
            return 'image/jpeg'
        case OutputFormat.Png:
            return 'image/png'
        default:
            return 'image/jpeg'
    }
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
