import type {
    CompressionResult,
    CompressionSettings,
    FitRequest,
    FitResult,
} from './compress';
import type { CompressRequest, CompressResponse } from './compress.worker';
import type { ImageBytes, SourceFormat } from './wasm';

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
    transfer: Array<Transferable> = [],
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
        instance.postMessage(build(id), transfer);
    });
}

/** Identifies the image the worker currently holds decoded. */
export type SourceToken = number;

let currentSource: SourceToken = 0;

/**
 * Hands the image to the worker, which decodes it once and keeps it for every
 * later pass. `source` is transferred, so the caller must not touch it again.
 *
 * The returned token goes back into `compress` and `fitToSize`; work for an
 * image the user has since replaced is dropped rather than run.
 */
export async function loadSource(
    source: ImageBytes,
    originalFormat: SourceFormat | null,
): Promise<SourceToken> {
    const token = ++currentSource;
    await request(
        (id) => ({ id, kind: 'load', source, originalFormat }),
        [source.buffer],
    );
    return token;
}

interface QueuedCompression {
    token: SourceToken;
    settings: CompressionSettings;
    resolve: (result: CompressionResult | null) => void;
    reject: (error: unknown) => void;
}

// The worker encodes one image at a time, and a preview the user has already
// edited past is worth nothing, so only the newest settings ever wait in line.
let inFlight = false;
let queued: QueuedCompression | null = null;

/**
 * Compresses the loaded image, resolving with `null` when the request was
 * superseded by newer settings or a newer image before it could run.
 */
export function compress(
    token: SourceToken,
    settings: CompressionSettings,
): Promise<CompressionResult | null> {
    return new Promise((resolve, reject) => {
        queued?.resolve(null);
        queued = { token, settings, resolve, reject };
        drain();
    });
}

function drain(): void {
    if (inFlight || !queued) return;

    const job = queued;
    queued = null;

    if (job.token !== currentSource) {
        job.resolve(null);
        return;
    }

    inFlight = true;
    request((id) => ({ id, kind: 'compress', settings: job.settings }))
        .then(({ blob, format, width, height, keptOriginal }) =>
            job.resolve({ blob, format, width, height, keptOriginal }),
        )
        .catch(job.reject)
        .finally(() => {
            inFlight = false;
            drain();
        });
}

/**
 * Solves for the quality that lands under `fit.targetBytes` and returns the
 * image that search already encoded.
 */
export async function fitToSize(
    token: SourceToken,
    fit: FitRequest,
): Promise<FitResult | null> {
    if (token !== currentSource) return null;

    const { blob, format, width, height, keptOriginal, quality } =
        await request((id) => ({ id, kind: 'fit', request: fit }));
    return { blob, format, width, height, keptOriginal, quality };
}
