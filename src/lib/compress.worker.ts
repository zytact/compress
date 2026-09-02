/// <reference lib="webworker" />
import { runCompression } from './compress';
import type { CompressionResult, CompressionSettings } from './compress';

export interface CompressRequest {
    id: number;
    source: Uint8Array;
    settings: CompressionSettings;
    originalFormat: string | null;
}

export type CompressResponse =
    | ({ id: number; ok: true } & CompressionResult)
    | { id: number; ok: false; error: string };

self.addEventListener(
    'message',
    async ({ data }: MessageEvent<CompressRequest>) => {
        const { id, source, settings, originalFormat } = data;
        try {
            const result = await runCompression(
                source,
                settings,
                originalFormat,
            );
            const response: CompressResponse = { id, ok: true, ...result };
            self.postMessage(response);
        } catch (error) {
            const response: CompressResponse = {
                id,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            };
            self.postMessage(response);
        }
    },
);
