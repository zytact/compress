'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';

import { FileDropzone } from './file-drop-zone';
import { SettingsPanel } from './settings-panel';
import { ErrorBanner } from './error-banner';
import { ImageCompare } from './image-compare';
import { ByteBar } from './byte-bar';
import { Button } from './button';
import type { ImageInfo } from '@/lib/wasm';
import type { CompressionSettings } from '@/lib/compress';
import type { FitOutcome } from '@/lib/compression-notice';
import { areSettingsCompressible } from '@/lib/compress';
import { describeCompression, describeFit } from '@/lib/compression-notice';
import { compress, fitQuality } from '@/lib/compress-client';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import {
    OutputFormat,
    convertHeicToJpeg,
    fileToUint8Array,
    formatBytes,
    getFileExtension,
    getImageDimensionsFromUrl,
    inferFormatFromFilename,
    replaceFileExtension,
} from '@/lib/wasm';

interface CompressedState {
    previewUrl: string;
    blob: Blob;
    format: OutputFormat;
    width: number;
    height: number;
    keptOriginal: boolean;
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

    const [width, setWidth] = useState(0);
    const [outputFormat, setOutputFormat] = useState<OutputFormat>(
        OutputFormat.Original,
    );
    const [quality, setQuality] = useState(85);

    const [targetKb, setTargetKb] = useState(500);
    const [fitting, setFitting] = useState(false);
    const [fit, setFit] = useState<FitOutcome | null>(null);

    const selectionRef = useRef(0);
    const fitAttemptRef = useRef(0);

    const invalidateFit = () => {
        fitAttemptRef.current++;
    };

    const handleFileSelect = useCallback(async (file: File) => {
        // Loading a file takes several awaits, and a newer pick wins them all
        const selection = ++selectionRef.current;
        const isCurrent = () => selectionRef.current === selection;

        setError(null);
        invalidateFit();
        setFit(null);
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
                setOutputFormat((current) =>
                    current === OutputFormat.Original
                        ? OutputFormat.Jpeg
                        : current,
                );
                source = await convertHeicToJpeg(file);
            }

            const previewUrl = URL.createObjectURL(source);
            const dims = await getImageDimensionsFromUrl(previewUrl);
            const bytes = await fileToUint8Array(source);

            if (!isCurrent()) {
                URL.revokeObjectURL(previewUrl);
                return;
            }

            setOriginalPreview(previewUrl);
            setOriginalInfo({
                width: dims.width,
                height: dims.height,
                size_bytes: file.size,
                format,
            });
            setWidth(dims.width);
            setSourceBytes(bytes);
        } catch (err) {
            if (!isCurrent()) return;
            setError(
                `Could not open this image: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }, []);

    const fitNote = describeFit(fit, { width, targetKb, quality });

    const aspectRatio =
        originalInfo && originalInfo.height > 0
            ? originalInfo.width / originalInfo.height
            : null;
    const height = aspectRatio
        ? Math.max(1, Math.round(width / aspectRatio))
        : 0;

    const settings = useMemo<CompressionSettings>(
        () => ({ width, height, format: outputFormat, quality }),
        [width, height, outputFormat, quality],
    );
    const debouncedSettings = useDebouncedValue(settings, LIVE_UPDATE_DELAY_MS);
    // Editing is still in flight while the debounced copy lags the live one
    const settled = debouncedSettings === settings;
    const originalFormat = originalInfo?.format ?? null;

    // Recompress whenever the image or its settled settings change
    useEffect(() => {
        if (!sourceBytes || !settled || !areSettingsCompressible(settings)) {
            setCompressing(false);
            return;
        }

        let cancelled = false;
        setCompressing(true);
        setError(null);

        compress(sourceBytes, settings, originalFormat)
            .then((result) => {
                if (cancelled) return;
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

    const notice =
        compressed && originalInfo
            ? describeCompression({
                  keptOriginal: compressed.keptOriginal,
                  outputFormat: compressed.format,
                  outputSize: compressed.blob.size,
                  originalSize: originalInfo.size_bytes,
                  originalFormat: originalInfo.format,
                  settings: debouncedSettings,
              })
            : null;

    // Release the previous object URLs once React has committed the new ones
    useEffect(() => {
        if (!originalPreview) return;
        return () => URL.revokeObjectURL(originalPreview);
    }, [originalPreview]);

    useEffect(() => {
        if (!compressed) return;
        return () => URL.revokeObjectURL(compressed.previewUrl);
    }, [compressed]);

    const handleFit = async () => {
        if (!sourceBytes || width <= 0) return;

        invalidateFit();
        const attempt = fitAttemptRef.current;

        setFitting(true);
        setError(null);
        try {
            const solved = await fitQuality(sourceBytes, {
                width,
                height,
                targetBytes: targetKb * 1024,
            });
            if (fitAttemptRef.current !== attempt) return;
            setQuality(solved);
            setFit({ width, targetKb, quality: solved });
        } catch (err) {
            if (fitAttemptRef.current !== attempt) return;
            setError(
                `Could not fit to that size: ${err instanceof Error ? err.message : String(err)}`,
            );
        } finally {
            if (fitAttemptRef.current === attempt) setFitting(false);
        }
    };

    const handleDownload = () => {
        if (!compressed || !selectedFile) return;

        const url = URL.createObjectURL(compressed.blob);
        const named = replaceFileExtension(
            selectedFile.name,
            getFileExtension(compressed.format),
        );
        const dot = named.lastIndexOf('.');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${named.slice(0, dot)}-compressed${named.slice(dot)}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!selectedFile || !originalInfo || !originalPreview) {
        return (
            <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
                <div className="max-w-xl space-y-4">
                    <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl">
                        Make an image
                        <br />
                        smaller.
                    </h1>
                    <p className="max-w-md text-lg text-muted-foreground">
                        Resize it, pick a format, and trade detail for bytes
                        until it fits. Nothing is uploaded: your image is
                        decoded and encoded in this tab.
                    </p>
                </div>

                <div className="mt-10 max-w-2xl space-y-4">
                    <FileDropzone onFileSelect={handleFileSelect} />
                    {error && <ErrorBanner message={error} />}
                </div>
            </div>
        );
    }

    const resultSize = compressed?.blob.size ?? null;

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 text-sm">
                    <span className="block truncate font-medium">
                        {selectedFile.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                        {originalInfo.width} × {originalInfo.height} ·{' '}
                        {originalInfo.format} ·{' '}
                        {formatBytes(originalInfo.size_bytes)}
                    </span>
                </p>
                <FileDropzone compact onFileSelect={handleFileSelect} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
                <div className="space-y-5">
                    <ImageCompare
                        originalUrl={originalPreview}
                        resultUrl={compressed?.previewUrl ?? null}
                        updating={compressing || !settled}
                    />

                    <ByteBar
                        originalSize={originalInfo.size_bytes}
                        resultSize={resultSize}
                    />

                    {error && <ErrorBanner message={error} />}

                    {notice && (
                        <div
                            className={cn(
                                'space-y-1 rounded-none border p-3 text-sm',
                                notice.tone === 'warning'
                                    ? 'border-signal/40 bg-signal-soft'
                                    : 'border-border bg-muted',
                            )}
                        >
                            <p className="font-medium">{notice.message}</p>
                            <p className="text-muted-foreground">
                                {notice.advice}
                            </p>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <SettingsPanel
                        originalWidth={originalInfo.width}
                        originalFormat={originalFormat}
                        width={width}
                        height={height}
                        onWidthChange={(next) => {
                            invalidateFit();
                            setWidth(next);
                        }}
                        format={outputFormat}
                        onFormatChange={setOutputFormat}
                        quality={quality}
                        onQualityChange={setQuality}
                        targetKb={targetKb}
                        onTargetKbChange={(next) => {
                            invalidateFit();
                            setTargetKb(next);
                        }}
                        onFit={handleFit}
                        fitting={fitting}
                        fitNote={fitNote}
                    />

                    <Button
                        size="lg"
                        onClick={handleDownload}
                        disabled={!compressed}
                        className="w-full"
                    >
                        <Download />
                        {resultSize === null
                            ? 'Download'
                            : `Download ${formatBytes(resultSize)}`}
                    </Button>

                    <p className="text-center text-xs text-muted-foreground">
                        Nothing leaves this tab.
                    </p>
                </div>
            </div>
        </div>
    );
}
