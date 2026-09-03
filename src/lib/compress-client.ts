import type {
    CompressionResult,
    CompressionSettings,
    FitRequest,
} from './compress';
import type { CompressRequest, CompressResponse } from './compress.worker';
import type { SourceFormat } from './wasm';

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

type Succeeded = Extract<CompressResponse, { ok: true }>;

function request<TKind extends CompressRequest['kind']>(
    build: (id: number) => Extract<CompressRequest, { kind: TKind }>,
): Promise<Extract<Succeeded, { kind: TKind }>> {
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
            if (!data.ok) {
                reject(new Error(data.error));
                return;
            }
            resolve(data as Extract<Succeeded, { kind: TKind }>);
        };

        // A worker that dies never answers, so fail the request with it
        const onError = (event: ErrorEvent) => {
            stopListening();
            worker = null;
            reject(new Error(event.message || 'Compression worker failed'));
        };

        instance.addEventListener('message', onMessage);
        instance.addEventListener('error', onError);
        instance.postMessage(build(id));
    });
}

/** Compresses one image in the worker and resolves with the encoded result. */
export async function compress(
    source: Uint8Array,
    settings: CompressionSettings,
    originalFormat: SourceFormat | null,
): Promise<CompressionResult> {
    const { blob, format, width, height, keptOriginal } = await request(
        (id) => ({
            id,
            kind: 'compress',
            source,
            settings,
            originalFormat,
        }),
    );
    return { blob, format, width, height, keptOriginal };
}

export async function fitQuality(
    source: Uint8Array,
    fit: FitRequest,
): Promise<number> {
    const { quality } = await request((id) => ({
        id,
        kind: 'fit',
        source,
        request: fit,
    }));
    return quality;
}
