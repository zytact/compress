import type { ImageInfo } from '@/lib/wasm'
import { formatBytes } from '@/lib/wasm'

interface OriginalPreviewProps {
    previewUrl: string | null
    info: ImageInfo | null
}

export function OriginalPreview({ previewUrl, info }: OriginalPreviewProps) {
    return (
        <div className="space-y-3">
            <h3 className="text-lg font-semibold">Original</h3>
            {previewUrl && (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                    <img
                        src={previewUrl}
                        alt="Original"
                        className="w-full h-auto"
                    />
                </div>
            )}
            {info && (
                <div className="text-sm space-y-1 text-zinc-600 dark:text-zinc-400">
                    <p>
                        Dimensions:{' '}
                        {info.width > 0 && info.height > 0
                            ? `${info.width} x ${info.height}`
                            : 'Unknown'}
                    </p>
                    <p>
                        Size:{' '}
                        {Number.isFinite(info.size_bytes) && info.size_bytes > 0
                            ? formatBytes(info.size_bytes)
                            : 'Unknown'}
                    </p>
                    <p>Format: {info.format || 'Unknown'}</p>
                </div>
            )}
        </div>
    )
}
