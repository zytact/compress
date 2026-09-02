import { Button } from './button';
import { formatBytes } from '@/lib/wasm';

interface CompressedInfo {
    size: number;
    width: number;
    height: number;
}

export type PreviewStatus =
    | 'loading'
    | 'idle'
    | 'waiting'
    | 'processing'
    | 'ready';

interface CompressedPreviewProps {
    previewUrl: string | null;
    info: CompressedInfo | null;
    originalSize?: number;
    status: PreviewStatus;
    onDownload: () => void;
}

export function CompressedPreview({
    previewUrl,
    info,
    originalSize,
    status,
    onDownload,
}: CompressedPreviewProps) {
    const isUpdating =
        status === 'loading' || status === 'waiting' || status === 'processing';
    const sizeChangePercent =
        info && originalSize
            ? ((originalSize - info.size) / originalSize) * 100
            : null;

    return (
        <div className="space-y-3">
            <div className="flex min-h-7 items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Compressed</h2>
                <p
                    className="text-sm text-muted-foreground"
                    role="status"
                    aria-live="polite"
                >
                    {status === 'loading'
                        ? 'Reading image...'
                        : isUpdating
                          ? 'Updating preview...'
                          : status === 'ready'
                            ? 'Preview is up to date'
                            : 'Waiting for valid settings'}
                </p>
            </div>
            {previewUrl ? (
                <>
                    <div
                        className="relative border border-border rounded-lg overflow-hidden"
                        aria-busy={isUpdating}
                    >
                        <img
                            src={previewUrl}
                            alt="Compressed"
                            className={`w-full h-auto transition-opacity ${
                                isUpdating ? 'opacity-60' : 'opacity-100'
                            }`}
                        />
                        {isUpdating && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                                <span className="rounded-md bg-background px-3 py-2 text-sm font-medium shadow-sm">
                                    Updating...
                                </span>
                            </div>
                        )}
                    </div>
                    {info && (
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <p>
                                Dimensions: {info.width} x {info.height}
                            </p>
                            <p>Size: {formatBytes(info.size)}</p>
                            {sizeChangePercent !== null && (
                                <p
                                    className={
                                        sizeChangePercent >= 0
                                            ? 'font-medium text-green-600 dark:text-green-400'
                                            : 'font-medium'
                                    }
                                >
                                    {sizeChangePercent >= 0
                                        ? `Reduction: ${sizeChangePercent.toFixed(1)}%`
                                        : `Increase: ${Math.abs(sizeChangePercent).toFixed(1)}%`}
                                </p>
                            )}
                        </div>
                    )}
                    <Button
                        onClick={onDownload}
                        className="w-full"
                        disabled={status !== 'ready'}
                    >
                        Download
                    </Button>
                </>
            ) : (
                <div
                    className="border border-dashed border-border rounded-lg h-64 flex items-center justify-center text-muted-foreground"
                    aria-busy={isUpdating}
                >
                    {status === 'loading'
                        ? 'Preparing source image...'
                        : isUpdating
                          ? 'Creating live preview...'
                          : 'Enter valid settings to create a preview'}
                </div>
            )}
        </div>
    );
}
