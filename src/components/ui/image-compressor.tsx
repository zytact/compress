'use client';

import { useCallback, useRef, useState } from 'react';
import { FileDropzone } from './file-drop-zone';
import { ModeTabs } from './mode-tabs';
import { DimensionsSettings } from './dimension-settings';
import { FilesizeSettings } from './file-size-settings';
import { PrimaryAction } from './primary-action';
import { ErrorBanner } from './error-banner';
import { PreviewPane } from './preview-pane';
import type { ImageInfo } from '@/lib/wasm';
import {
    OutputFormat,
    fileToUint8Array,
    getImageDimensionsFromUrl,
    getMimeType,
    inferFormatFromFilename,
    resizeByDimensions,
    resizeByFilesize,
    uint8ArrayToBlob,
} from '@/lib/wasm';

type TabMode = 'dimensions' | 'filesize';

export default function ImageCompressor() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [originalPreview, setOriginalPreview] = useState<string | null>(null);
    const [compressedPreview, setCompressedPreview] = useState<string | null>(
        null,
    );
    const [originalInfo, setOriginalInfo] = useState<ImageInfo | null>(null);
    const [compressedInfo, setCompressedInfo] = useState<{
        size: number;
        width: number;
        height: number;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tabMode, setTabMode] = useState<TabMode>('dimensions');

    const [width, setWidth] = useState<number>(1920);
    const [height, setHeight] = useState<number>(1080);
    const [outputFormat, setOutputFormat] = useState<OutputFormat>(
        OutputFormat.Jpeg,
    );
    const [quality, setQuality] = useState<number>(85);

    const [targetSize, setTargetSize] = useState<number>(500);

    const compressedBlobRef = useRef<Blob | null>(null);

    const handleFileSelect = useCallback(async (file: File) => {
        setError(null);
        setSelectedFile(file);
        setCompressedPreview(null);
        setCompressedInfo(null);

        const previewUrl = URL.createObjectURL(file);
        setOriginalPreview(previewUrl);

        try {
            const browserDims = await getImageDimensionsFromUrl(previewUrl);

            const imgWidth = browserDims.width;
            const imgHeight = browserDims.height;

            const format = inferFormatFromFilename(file.name);

            const size_bytes = file.size;

            const info: ImageInfo = {
                width: imgWidth,
                height: imgHeight,
                size_bytes,
                format,
            };

            setOriginalInfo(info);
            setWidth(imgWidth);
            setHeight(imgHeight);
        } catch (err) {
            setError(
                `Failed to load image: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }, []);

    const handleCompress = async () => {
        if (!selectedFile) return;

        setLoading(true);
        setError(null);

        try {
            const data = await fileToUint8Array(selectedFile);
            let result: Uint8Array;

            if (tabMode === 'dimensions') {
                result = await resizeByDimensions(data, {
                    width,
                    height,
                    format: outputFormat,
                    quality,
                });
            } else {
                result = await resizeByFilesize(data, {
                    targetBytes: targetSize * 1024,
                    floorQuality: 30,
                    ceilQuality: 95,
                    tolerancePercent: 0,
                });
            }

            const mimeType =
                tabMode === 'dimensions'
                    ? getMimeType(outputFormat)
                    : 'image/jpeg';
            const blob = uint8ArrayToBlob(result, mimeType);
            compressedBlobRef.current = blob;

            const previewUrl = URL.createObjectURL(blob);
            setCompressedPreview(previewUrl);

            const img = new Image();
            img.onload = () => {
                setCompressedInfo({
                    size: blob.size,
                    width: img.width,
                    height: img.height,
                });
                URL.revokeObjectURL(previewUrl);
            };
            img.src = previewUrl;
        } catch (err) {
            setError(
                `Compression failed: ${err instanceof Error ? err.message : String(err)}`,
            );
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!compressedBlobRef.current) return;

        const url = URL.createObjectURL(compressedBlobRef.current);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compressed_${selectedFile?.name || 'image.jpg'}`;
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
                <p className="text-zinc-600 dark:text-zinc-400">
                    Resize and compress images entirely in your browser using
                    WebAssembly
                </p>
            </div>

            <FileDropzone onFileSelect={handleFileSelect} disabled={loading} />

            {error && <ErrorBanner message={error} />}

            {selectedFile && (
                <>
                    <ModeTabs value={tabMode} onChange={setTabMode} />

                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-6 space-y-4">
                        {tabMode === 'dimensions' ? (
                            <DimensionsSettings
                                width={width}
                                height={height}
                                originalWidth={originalInfo?.width ?? null}
                                originalHeight={originalInfo?.height ?? null}
                                outputFormat={outputFormat}
                                quality={quality}
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

                        <PrimaryAction
                            onClick={handleCompress}
                            loading={loading}
                            disabled={!selectedFile}
                        />
                    </div>

                    <PreviewPane
                        original={{
                            previewUrl: originalPreview,
                            info: originalInfo,
                        }}
                        compressed={{
                            previewUrl: compressedPreview,
                            info: compressedInfo,
                            originalSize: originalInfo?.size_bytes,
                        }}
                        onDownload={handleDownload}
                    />
                </>
            )}
        </div>
    );
}
