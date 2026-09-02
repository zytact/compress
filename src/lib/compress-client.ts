import type { CompressionResult, CompressionSettings } from './compress';
import type { CompressResponse } from './compress.worker';

// Compression runs off the main thread so live preview updates never freeze the
// page while WASM encodes.
let worker: Worker | null = null;
let nextRequestId = 0;

function getWorker(): Worker {
    worker ??= new Worker(new URL('./compress.worker.ts', import.meta.url), {
        type: 'module',
    });
    return worker;
}

/** Compresses one image in the worker and resolves with the encoded result. */
export function compress(
    source: Uint8Array,
    settings: CompressionSettings,
    originalFormat: string | null,
): Promise<CompressionResult> {
    const id = nextRequestId++;
    const instance = getWorker();

    return new Promise((resolve, reject) => {
        const stopListening = () => {
            instance.removeEventListener('message', onMessage);
            instance.removeEventListener('error', onError);
        };

        const onMessage = ({ data }: MessageEvent<CompressResponse>) => {
            if (data.id !== id) return;
            stopListening();
            if (data.ok) {
                const { blob, format, width, height, keptOriginal } = data;
                resolve({ blob, format, width, height, keptOriginal });
            } else {
                reject(new Error(data.error));
            }
        };

        // A worker that dies never answers, so fail the request with it
        const onError = (event: ErrorEvent) => {
            stopListening();
            worker = null;
            reject(new Error(event.message || 'Compression worker failed'));
        };

        instance.addEventListener('message', onMessage);
        instance.addEventListener('error', onError);
        instance.postMessage({ id, source, settings, originalFormat });
    });
}
