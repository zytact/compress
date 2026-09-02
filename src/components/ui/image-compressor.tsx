'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDropzone } from './file-drop-zone';
import { ModeTabs } from './mode-tabs';
import { DimensionsSettings } from './dimension-settings';
import { FilesizeSettings } from './file-size-settings';
import { ErrorBanner } from './error-banner';
import { PreviewPane } from './preview-pane';
import type { ImageInfo } from '@/lib/wasm';
import type { CompressionSettings } from '@/lib/compress';
import { areSettingsCompressible } from '@/lib/compress';
import { compress } from '@/lib/compress-client';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
    OutputFormat,
    convertHeicToJpeg,
    fileToUint8Array,
    getFileExtension,
    getImageDimensionsFromUrl,
    inferFormatFromFilename,
    replaceFileExtension,
} from '@/lib/wasm';

type TabMode = 'dimensions' | 'filesize';

interface CompressedState {
    previewUrl: string;
    blob: Blob;
    format: OutputFormat;
    width: number;
    height: number;
}

/** Long enough to swallow a slider drag, short enough to still feel live. */
const LIVE_UPDATE_DELAY_MS = 300;

export default function ImageCompressor() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [sourceBytes, setSourceBytes] = useState<Uint8Array | null>(null);
    const [originalPreview, setOriginalPreview] = useState<string | null>(null);
    const [originalInfo, setOriginalInfo] = useState<ImageInfo | null>(null);
    const [compressed, setCompressed] = useState<CompressedState | null>(null);
    const [compressing, setCompressing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tabMode, setTabMode] = useState<TabMode>('dimensions');

    const [width, setWidth] = useState<number>(1920);
    const [height, setHeight] = useState<number>(1080);
    const [outputFormat, setOutputFormat] = useState<OutputFormat>(
        OutputFormat.Jpeg,
    );
    const [quality, setQuality] = useState<number>(85);

    const [targetSize, setTargetSize] = useState<number>(500);

    const handleFileSelect = useCallback(
        async (file: File) => {
            setError(null);
            setSelectedFile(file);
            setSourceBytes(null);
            setCompressed(null);
            setOriginalPreview(null);
            setOriginalInfo(null);

            try {
                const format = inferFormatFromFilename(file.name);
                let source: Blob = file;

                // HEIC cannot be decoded by the WASM encoder, so convert it first
                if (format === 'HEIC') {
                    if (outputFormat === OutputFormat.Original) {
                        setOutputFormat(OutputFormat.Jpeg);
                    }
                    source = await convertHeicToJpeg(file);
                }

                const previewUrl = URL.createObjectURL(source);
                setOriginalPreview(previewUrl);

                const dims = await getImageDimensionsFromUrl(previewUrl);
                setOriginalInfo({
                    width: dims.width,
                    height: dims.height,
                    size_bytes: file.size,
                    format,
                });
                setWidth(dims.width);
                setHeight(dims.height);
                setSourceBytes(await fileToUint8Array(source));
            } catch (err) {
                setError(
                    `Failed to load image: ${err instanceof Error ? err.message : String(err)}`,
                );
            }
        },
        [outputFormat],
    );

    const settings = useMemo<CompressionSettings>(
        () =>
            tabMode === 'dimensions'
                ? {
                      mode: 'dimensions',
                      width,
                      height,
                      format: outputFormat,
                      quality,
                  }
                : { mode: 'filesize', targetKb: targetSize },
        [tabMode, width, height, outputFormat, quality, targetSize],
    );
    const liveSettings = useDebouncedValue(settings, LIVE_UPDATE_DELAY_MS);
    // Editing is still in flight while the debounced copy lags the live one
    const settled = liveSettings === settings;
    const originalFormat = originalInfo?.format ?? null;

    // Recompress whenever the image or its settled settings change
    useEffect(() => {
        if (!sourceBytes || !settled || !areSettingsCompressible(settings))
            return;

        let cancelled = false;
        setCompressing(true);

        compress(sourceBytes, settings, originalFormat)
            .then((result) => {
                if (cancelled) return;
                setError(null);
                setCompressed({
                    previewUrl: URL.createObjectURL(result.blob),
                    ...result,
                });
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setError(
                    `Compression failed: ${err instanceof Error ? err.message : String(err)}`,
                );
            })
            .finally(() => {
                if (!cancelled) setCompressing(false);
            });

        return () => {
            cancelled = true;
        };
    }, [sourceBytes, settings, settled, originalFormat]);

    // Release the previous object URLs once React has committed the new ones
    useEffect(() => {
        if (!originalPreview) return;
        return () => URL.revokeObjectURL(originalPreview);
    }, [originalPreview]);

    useEffect(() => {
        if (!compressed) return;
        return () => URL.revokeObjectURL(compressed.previewUrl);
    }, [compressed]);

    const handleDownload = () => {
        if (!compressed || !selectedFile) return;

        const url = URL.createObjectURL(compressed.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compressed_${replaceFileExtension(selectedFile.name, getFileExtension(compressed.format))}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold tracking-tight">
                    Image Compressor
                </h1>
                <p className="text-muted-foreground">
                    Resize and compress images entirely in your browser using
                    WebAssembly
                </p>
            </div>

            <FileDropzone onFileSelect={handleFileSelect} />

            {error && <ErrorBanner message={error} />}

            {selectedFile && (
                <>
                    <ModeTabs value={tabMode} onChange={setTabMode} />

                    <div className="bg-muted rounded-lg p-6 space-y-4">
                        {tabMode === 'dimensions' ? (
                            <DimensionsSettings
                                width={width}
                                height={height}
                                originalWidth={originalInfo?.width ?? null}
                                originalHeight={originalInfo?.height ?? null}
                                outputFormat={outputFormat}
                                quality={quality}
                                originalFormat={originalFormat}
                                onDimensionsChange={(w, h) => {
                                    setWidth(w);
                                    setHeight(h);
                                }}
                                onOutputFormatChange={setOutputFormat}
                                onQualityChange={setQuality}
                            />
                        ) : (
                            <FilesizeSettings
                                targetSize={targetSize}
                                onTargetSizeChange={setTargetSize}
                            />
                        )}
                    </div>

                    <PreviewPane
                        original={{
                            previewUrl: originalPreview,
                            info: originalInfo,
                        }}
                        compressed={{
                            previewUrl: compressed?.previewUrl ?? null,
                            info: compressed
                                ? {
                                      size: compressed.blob.size,
                                      width: compressed.width,
                                      height: compressed.height,
                                  }
                                : null,
                            originalSize: originalInfo?.size_bytes,
                            updating: compressing || !settled,
                        }}
                        onDownload={handleDownload}
                    />
                </>
            )}
        </div>
    );
}
