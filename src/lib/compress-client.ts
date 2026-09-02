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
        const onMessage = ({ data }: MessageEvent<CompressResponse>) => {
            if (data.id !== id) return;
            instance.removeEventListener('message', onMessage);
            if (data.ok) {
                const { blob, format, width, height } = data;
                resolve({ blob, format, width, height });
            } else {
                reject(new Error(data.error));
            }
        };

        instance.addEventListener('message', onMessage);
        instance.postMessage({ id, source, settings, originalFormat });
    });
}
