/// <reference lib="webworker" />
import { runCompression, runFit } from './compress';
import { ImageSource } from './wasm';
import type {
    CompressionResult,
    CompressionSettings,
    FitRequest,
    FitResult,
} from './compress';
import type { ImageBytes, SourceFormat } from './wasm';

export type CompressRequest =
    | {
          id: number;
          kind: 'load';
          source: ImageBytes;
          originalFormat: SourceFormat | null;
      }
    | { id: number; kind: 'compress'; settings: CompressionSettings }
    | { id: number; kind: 'fit'; request: FitRequest };

export type CompressResponse =
    | { id: number; ok: true; kind: 'load' }
    | ({ id: number; ok: true; kind: 'compress' } & CompressionResult)
    | ({ id: number; ok: true; kind: 'fit' } & FitResult)
    | { id: number; ok: false; error: string };

interface Loaded {
    image: ImageSource;
    originalFormat: SourceFormat | null;
}

let loaded: Loaded | null = null;

function requireLoaded(): Loaded {
    if (!loaded) throw new Error('No image has been loaded');
    return loaded;
}

async function handle(data: CompressRequest): Promise<CompressResponse> {
    if (data.kind === 'load') {
        // The decoded pixels of the outgoing image are dead the moment a new
        // one arrives, and WASM memory is not garbage collected
        loaded?.image.free();
        loaded = null;

        const image = await ImageSource.create(data.source);
        loaded = { image, originalFormat: data.originalFormat };
        return { id: data.id, ok: true, kind: 'load' };
    }

    const { image, originalFormat } = requireLoaded();

    if (data.kind === 'fit') {
        const result = runFit(image, data.request, originalFormat);
        return { id: data.id, ok: true, kind: 'fit', ...result };
    }

    const result = runCompression(image, data.settings, originalFormat);
    return { id: data.id, ok: true, kind: 'compress', ...result };
}

// Requests mutate and read the one loaded image, so they run one after another
// rather than interleaving at their awaits
let queue: Promise<void> = Promise.resolve();

self.addEventListener('message', ({ data }: MessageEvent<CompressRequest>) => {
    queue = queue.then(async () => {
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
    });
});
