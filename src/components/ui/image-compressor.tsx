'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileDropzone } from './file-drop-zone';
import { ModeTabs } from './mode-tabs';
import { DimensionsSettings } from './dimension-settings';
import { FilesizeSettings } from './file-size-settings';
import { ErrorBanner } from './error-banner';
import { PreviewPane } from './preview-pane';
import type { PreviewStatus } from './compressed-preview';
import type { ImageInfo } from '@/lib/wasm';
import {
    OutputFormat,
    convertHeicToJpeg,
    fileToUint8Array,
    getFileExtension,
    getImageDimensionsFromUrl,
    getMimeType,
    inferFormatFromFilename,
    replaceFileExtension,
    resizeByDimensions,
    resizeByFilesize,
    uint8ArrayToBlob,
} from '@/lib/wasm';

type TabMode = 'dimensions' | 'filesize';
const LIVE_UPDATE_DELAY_MS = 300;

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
    const [sourceData, setSourceData] = useState<Uint8Array | null>(null);
    const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
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
    const compressedFormatRef = useRef<OutputFormat>(OutputFormat.Jpeg);
    const originalPreviewRef = useRef<string | null>(null);
    const compressedPreviewRef = useRef<string | null>(null);
    const fileSelectionIdRef = useRef(0);
    const compressionIdRef = useRef(0);

    const replaceOriginalPreview = useCallback((url: string | null) => {
        if (originalPreviewRef.current) {
            URL.revokeObjectURL(originalPreviewRef.current);
        }
        originalPreviewRef.current = url;
        setOriginalPreview(url);
    }, []);

    const replaceCompressedPreview = useCallback((url: string | null) => {
        if (compressedPreviewRef.current) {
            URL.revokeObjectURL(compressedPreviewRef.current);
        }
        compressedPreviewRef.current = url;
        setCompressedPreview(url);
    }, []);

    useEffect(
        () => () => {
            if (originalPreviewRef.current) {
                URL.revokeObjectURL(originalPreviewRef.current);
            }
            if (compressedPreviewRef.current) {
                URL.revokeObjectURL(compressedPreviewRef.current);
            }
        },
        [],
    );

    const handleFileSelect = useCallback(
        async (file: File) => {
            const selectionId = ++fileSelectionIdRef.current;
            compressionIdRef.current += 1;
            setError(null);
            setSelectedFile(file);
            setSourceData(null);
            setPreviewStatus('loading');
            replaceOriginalPreview(null);
            replaceCompressedPreview(null);
            setCompressedInfo(null);
            setOriginalInfo(null);
            compressedBlobRef.current = null;

            let previewUrl: string | null = null;
            try {
                const format = inferFormatFromFilename(file.name);
                let sourceFile: File = file;

                // If HEIC, attempt browser-native conversion to JPEG
                if (format === 'HEIC') {
                    // If user had "Original" selected, switch to JPEG
                    if (outputFormat === OutputFormat.Original) {
                        setOutputFormat(OutputFormat.Jpeg);
                    }

                    try {
                        const convertedBlob = await convertHeicToJpeg(file);
                        sourceFile = new File([convertedBlob], file.name, {
                            type: convertedBlob.type,
                        });
                        previewUrl = URL.createObjectURL(convertedBlob);
                    } catch (conversionError) {
                        throw new Error(
                            `${conversionError instanceof Error ? conversionError.message : String(conversionError)}`,
                        );
                    }
                } else {
                    previewUrl = URL.createObjectURL(file);
                }

                const [browserDims, data] = await Promise.all([
                    getImageDimensionsFromUrl(previewUrl),
                    fileToUint8Array(sourceFile),
                ]);

                if (selectionId !== fileSelectionIdRef.current) {
                    URL.revokeObjectURL(previewUrl);
                    return;
                }

                replaceOriginalPreview(previewUrl);

                const imgWidth = browserDims.width;
                const imgHeight = browserDims.height;

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
                setSourceData(data);
            } catch (err) {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                if (selectionId !== fileSelectionIdRef.current) return;
                setPreviewStatus('idle');
                setError(
                    `Failed to load image: ${err instanceof Error ? err.message : String(err)}`,
                );
            }
        },
        [outputFormat, replaceCompressedPreview, replaceOriginalPreview],
    );

    useEffect(() => {
        if (!sourceData || !originalInfo) return;

        const hasValidSettings =
            tabMode === 'dimensions' ? width > 0 && height > 0 : targetSize > 0;
        if (!hasValidSettings) {
            compressionIdRef.current += 1;
            setPreviewStatus('idle');
            return;
        }

        const compressionId = ++compressionIdRef.current;
        setPreviewStatus('waiting');
        setError(null);

        const timeout = window.setTimeout(() => {
            const compress = async () => {
                setPreviewStatus('processing');

                try {
                    let result: Uint8Array;
                    let actualFormat: OutputFormat;

                    if (tabMode === 'dimensions') {
                        let effectiveFormat = outputFormat;
                        if (outputFormat === OutputFormat.Original) {
                            const originalFormat =
                                originalInfo.format.toUpperCase();
                            effectiveFormat =
                                originalFormat === 'PNG'
                                    ? OutputFormat.Png
                                    : OutputFormat.Jpeg;
                        }

                        result = await resizeByDimensions(sourceData, {
                            width,
                            height,
                            format: effectiveFormat,
                            quality,
                        });
                        actualFormat = effectiveFormat;
                    } else {
                        result = await resizeByFilesize(sourceData, {
                            targetBytes: targetSize * 1024,
                            floorQuality: 30,
                            ceilQuality: 95,
                            tolerancePercent: 0,
                        });
                        actualFormat = OutputFormat.Jpeg;
                    }

                    const mimeType = getMimeType(actualFormat);
                    const blob = uint8ArrayToBlob(result, mimeType);
                    const previewUrl = URL.createObjectURL(blob);
                    const dimensions =
                        await getImageDimensionsFromUrl(previewUrl);

                    if (compressionId !== compressionIdRef.current) {
                        URL.revokeObjectURL(previewUrl);
                        return;
                    }

                    compressedBlobRef.current = blob;
                    compressedFormatRef.current = actualFormat;
                    replaceCompressedPreview(previewUrl);
                    setCompressedInfo({
                        size: blob.size,
                        width: dimensions.width,
                        height: dimensions.height,
                    });
                    setPreviewStatus('ready');
                } catch (err) {
                    if (compressionId !== compressionIdRef.current) return;
                    setPreviewStatus('idle');
                    setError(
                        `Compression failed: ${err instanceof Error ? err.message : String(err)}`,
                    );
                }
            };

            void compress();
        }, LIVE_UPDATE_DELAY_MS);

        return () => {
            window.clearTimeout(timeout);
            if (compressionIdRef.current === compressionId) {
                compressionIdRef.current += 1;
            }
        };
    }, [
        height,
        originalInfo,
        outputFormat,
        quality,
        replaceCompressedPreview,
        sourceData,
        tabMode,
        targetSize,
        width,
    ]);

    const handleDownload = () => {
        if (!compressedBlobRef.current || !selectedFile) return;

        const url = URL.createObjectURL(compressedBlobRef.current);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;

        // Use the actual format that was used during compression
        const newExtension = getFileExtension(compressedFormatRef.current);
        const downloadFilename = `compressed_${replaceFileExtension(selectedFile.name, newExtension)}`;

        downloadLink.download = downloadFilename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
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
                                originalFormat={originalInfo?.format ?? null}
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

                        <p className="text-sm text-muted-foreground">
                            Changes update the preview automatically.
                        </p>
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
                            status: previewStatus,
                        }}
                        onDownload={handleDownload}
                    />
                </>
            )}
        </div>
    );
}
