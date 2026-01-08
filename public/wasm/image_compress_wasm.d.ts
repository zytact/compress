/* tslint:disable */
/* eslint-disable */

export enum OutputFormat {
  Jpeg = 0,
  Png = 1,
  Original = 2,
}

export function init_panic_hook(): void;

/**
 * Resize image by exact dimensions
 *
 * # Arguments
 * * `data` - Input image bytes
 * * `width` - Target width
 * * `height` - Target height
 * * `format` - Output format (Jpeg, Png, Original)
 * * `quality` - JPEG quality 1-100 (optional, default 85)
 */
export function resize_by_dimensions(data: Uint8Array, width: number, height: number, format: OutputFormat, quality?: number | null): Uint8Array;

/**
 * Resize image to target file size
 * Uses binary search on JPEG quality to hit target size
 *
 * # Arguments
 * * `data` - Input image bytes
 * * `target_bytes` - Target file size in bytes
 * * `floor_quality` - Minimum JPEG quality (default 30)
 * * `ceil_quality` - Maximum JPEG quality (default 95)
 * * `tolerance_percent` - Acceptable deviation from target (default 5%)
 */
export function resize_by_filesize(data: Uint8Array, target_bytes: number, floor_quality?: number | null, ceil_quality?: number | null, _tolerance_percent?: number | null): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly resize_by_dimensions: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly resize_by_filesize: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly init_panic_hook: () => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
