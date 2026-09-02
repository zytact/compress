import { OriginalPreview } from './original-preview';
import { CompressedPreview } from './compressed-preview';
import type { ImageInfo } from '@/lib/wasm';
import type { CompressionNotice } from '@/lib/compression-notice';

interface CompressedInfo {
    size: number;
    width: number;
    height: number;
}

interface PreviewPaneProps {
    original: {
        previewUrl: string | null;
        info: ImageInfo | null;
    };
    compressed: {
        previewUrl: string | null;
        info: CompressedInfo | null;
        originalSize?: number;
        notice: CompressionNotice | null;
        updating: boolean;
    };
    onDownload: () => void;
}

export function PreviewPane({
    original,
    compressed,
    onDownload,
}: PreviewPaneProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <OriginalPreview
                previewUrl={original.previewUrl}
                info={original.info}
            />
            <CompressedPreview
                previewUrl={compressed.previewUrl}
                info={compressed.info}
                originalSize={compressed.originalSize}
                notice={compressed.notice}
                updating={compressed.updating}
                onDownload={onDownload}
            />
        </div>
    );
}
