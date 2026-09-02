import { Loader2 } from 'lucide-react';
import { Button } from './button';
import { formatBytes } from '@/lib/wasm';

interface CompressedInfo {
    size: number;
    width: number;
    height: number;
}

interface CompressedPreviewProps {
    previewUrl: string | null;
    info: CompressedInfo | null;
    originalSize?: number;
    updating: boolean;
    onDownload: () => void;
}

export function CompressedPreview({
    previewUrl,
    info,
    originalSize,
    updating,
    onDownload,
}: CompressedPreviewProps) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Compressed</h3>
                {updating && previewUrl && (
                    <span
                        role="status"
                        className="flex items-center gap-1.5 text-sm text-muted-foreground"
                    >
                        <Loader2 className="size-4 animate-spin" />
                        Updating
                    </span>
                )}
            </div>
            {previewUrl ? (
                <>
                    <div className="border border-border rounded-lg overflow-hidden">
                        <img
                            src={previewUrl}
                            alt="Compressed"
                            className={`w-full h-auto transition-opacity ${updating ? 'opacity-50' : 'opacity-100'}`}
                        />
                    </div>
                    {info && (
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <p>
                                Dimensions: {info.width} x {info.height}
                            </p>
                            <p>Size: {formatBytes(info.size)}</p>
                            {originalSize && (
                                <p className="font-medium text-green-600 dark:text-green-400">
                                    Reduction:{' '}
                                    {(
                                        ((originalSize - info.size) /
                                            originalSize) *
                                        100
                                    ).toFixed(1)}
                                    %
                                </p>
                            )}
                        </div>
                    )}
                    <Button onClick={onDownload} className="w-full">
                        Download
                    </Button>
                </>
            ) : (
                <div className="border border-dashed border-border rounded-lg h-64 flex items-center justify-center text-muted-foreground">
                    {updating
                        ? 'Compressing image...'
                        : 'Compressed image will appear here'}
                </div>
            )}
        </div>
    );
}
