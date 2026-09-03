/// <reference lib="webworker" />
import { runCompression, runFit } from './compress';
import type {
    CompressionResult,
    CompressionSettings,
    FitRequest,
} from './compress';
import type { SourceFormat } from './wasm';

export type CompressRequest =
    | {
          id: number;
          kind: 'compress';
          source: Uint8Array;
          settings: CompressionSettings;
          originalFormat: SourceFormat | null;
      }
    | { id: number; kind: 'fit'; source: Uint8Array; request: FitRequest };

export type CompressResponse =
    | ({ id: number; ok: true; kind: 'compress' } & CompressionResult)
    | { id: number; ok: true; kind: 'fit'; quality: number }
    | { id: number; ok: false; error: string };

async function handle(data: CompressRequest): Promise<CompressResponse> {
    if (data.kind === 'fit') {
        const quality = await runFit(data.source, data.request);
        return { id: data.id, ok: true, kind: 'fit', quality };
    }

    const result = await runCompression(
        data.source,
        data.settings,
        data.originalFormat,
    );
    return { id: data.id, ok: true, kind: 'compress', ...result };
}

self.addEventListener(
    'message',
    async ({ data }: MessageEvent<CompressRequest>) => {
        try {
            self.postMessage(await handle(data));
        } catch (error) {
            const response: CompressResponse = {
                id: data.id,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            };
            self.postMessage(response);
        }
    },
);
