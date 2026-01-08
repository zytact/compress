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
    onDownload: () => void;
}

export function CompressedPreview({
    previewUrl,
    info,
    originalSize,
    onDownload,
}: CompressedPreviewProps) {
    return (
        <div className="space-y-3">
            <h3 className="text-lg font-semibold">Compressed</h3>
            {previewUrl ? (
                <>
                    <div className="border border-border rounded-lg overflow-hidden">
                        <img
                            src={previewUrl}
                            alt="Compressed"
                            className="w-full h-auto"
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
                    Compressed image will appear here
                </div>
            )}
        </div>
    );
}
