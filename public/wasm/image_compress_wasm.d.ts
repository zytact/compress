/* tslint:disable */
/* eslint-disable */

export class EncodedImage {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export class FitResult {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly quality: number;
}

export class ImageSource {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Encode at the highest JPEG quality that still lands under `target_bytes`.
   *
   * Resizes once up front so a target size and a target width can be asked
   * for together, then binary searches quality over the resized image.
   *
   * # Arguments
   * * `width` - Target width
   * * `height` - Target height
   * * `target_bytes` - Size the output must stay under
   * * `floor_quality` - Minimum JPEG quality (default 30)
   * * `ceil_quality` - Maximum JPEG quality (default 95)
   */
  fit_to_filesize(width: number, height: number, target_bytes: number, floor_quality?: number | null, ceil_quality?: number | null): FitResult;
  constructor(data: Uint8Array);
  /**
   * Encode at an exact size.
   *
   * # Arguments
   * * `width` - Target width
   * * `height` - Target height
   * * `format` - Output format (Jpeg, Png, Original)
   * * `quality` - JPEG quality 1-100 (optional, default 85)
   */
  encode(width: number, height: number, format: OutputFormat, quality?: number | null): EncodedImage;
  readonly width: number;
  readonly height: number;
}

export enum OutputFormat {
  Jpeg = 0,
  Png = 1,
  Original = 2,
}

export function init_panic_hook(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_encodedimage_free: (a: number, b: number) => void;
  readonly __wbg_fitresult_free: (a: number, b: number) => void;
  readonly __wbg_imagesource_free: (a: number, b: number) => void;
  readonly encodedimage_data: (a: number) => [number, number];
  readonly encodedimage_height: (a: number) => number;
  readonly encodedimage_width: (a: number) => number;
  readonly fitresult_data: (a: number) => [number, number];
  readonly fitresult_quality: (a: number) => number;
  readonly imagesource_encode: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly imagesource_fit_to_filesize: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
  readonly imagesource_height: (a: number) => number;
  readonly imagesource_new: (a: number, b: number) => [number, number, number];
  readonly imagesource_width: (a: number) => number;
  readonly init_panic_hook: () => void;
  readonly fitresult_height: (a: number) => number;
  readonly fitresult_width: (a: number) => number;
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
