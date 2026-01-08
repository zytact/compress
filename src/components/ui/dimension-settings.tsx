import { useEffect, useState } from 'react';
import { OutputFormat } from '@/lib/wasm';

interface DimensionsSettingsProps {
    width: number;
    height: number;
    originalWidth: number | null;
    originalHeight: number | null;
    outputFormat: OutputFormat;
    quality: number;
    originalFormat: string | null;
    onDimensionsChange: (width: number, height: number) => void;
    onOutputFormatChange: (value: OutputFormat) => void;
    onQualityChange: (value: number) => void;
}

export function DimensionsSettings({
    width,
    height,
    originalWidth,
    originalHeight,
    outputFormat,
    quality,
    originalFormat,
    onDimensionsChange,
    onOutputFormatChange,
    onQualityChange,
}: DimensionsSettingsProps) {
    // Calculate aspect ratio from original image
    const aspectRatio =
        originalWidth && originalHeight ? originalWidth / originalHeight : null;
    // Track if user attempted to exceed original dimensions
    const [widthExceeded, setWidthExceeded] = useState(false);
    const [heightExceeded, setHeightExceeded] = useState(false);

    const handleWidthChange = (value: number) => {
        const exceeds = originalWidth !== null && value > originalWidth;
        setWidthExceeded(exceeds);

        // Clamp to original dimensions (no upscaling)
        const clampedWidth = originalWidth
            ? Math.min(value, originalWidth)
            : value;

        if (aspectRatio && clampedWidth > 0) {
            // Auto-calculate height based on aspect ratio
            const calculatedHeight = Math.round(clampedWidth / aspectRatio);
            onDimensionsChange(clampedWidth, calculatedHeight);
        } else {
            onDimensionsChange(clampedWidth, height);
        }
    };

    const handleHeightChange = (value: number) => {
        const exceeds = originalHeight !== null && value > originalHeight;
        setHeightExceeded(exceeds);

        // Clamp to original dimensions (no upscaling)
        const clampedHeight = originalHeight
            ? Math.min(value, originalHeight)
            : value;

        if (aspectRatio && clampedHeight > 0) {
            // Auto-calculate width based on aspect ratio
            const calculatedWidth = Math.round(clampedHeight * aspectRatio);
            onDimensionsChange(calculatedWidth, clampedHeight);
        } else {
            onDimensionsChange(width, clampedHeight);
        }
    };

    // Clear exceeded state after a delay (visual feedback)
    useEffect(() => {
        if (widthExceeded) {
            const timer = setTimeout(() => setWidthExceeded(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [widthExceeded]);

    useEffect(() => {
        if (heightExceeded) {
            const timer = setTimeout(() => setHeightExceeded(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [heightExceeded]);

    return (
        <>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Width (px)
                    </label>
                    <input
                        type="number"
                        value={width}
                        min={1}
                        max={originalWidth ?? undefined}
                        onChange={(e) =>
                            handleWidthChange(parseInt(e.target.value) || 0)
                        }
                        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 ${
                            widthExceeded
                                ? 'border-amber-500 ring-1 ring-amber-500'
                                : 'border-zinc-300 dark:border-zinc-700'
                        }`}
                    />
                    {widthExceeded && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Clamped to max: {originalWidth}px
                        </p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Height (px)
                    </label>
                    <input
                        type="number"
                        value={height}
                        min={1}
                        max={originalHeight ?? undefined}
                        onChange={(e) =>
                            handleHeightChange(parseInt(e.target.value) || 0)
                        }
                        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 ${
                            heightExceeded
                                ? 'border-amber-500 ring-1 ring-amber-500'
                                : 'border-zinc-300 dark:border-zinc-700'
                        }`}
                    />
                    {heightExceeded && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Clamped to max: {originalHeight}px
                        </p>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-2">
                    Output Format
                </label>
                <select
                    value={outputFormat}
                    onChange={(e) =>
                        onOutputFormatChange(
                            parseInt(e.target.value) as OutputFormat,
                        )
                    }
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
                >
                    <option value={OutputFormat.Jpeg}>JPEG</option>
                    <option value={OutputFormat.Png}>PNG</option>
                    <option value={OutputFormat.Original}>
                        Original Format
                    </option>
                </select>
            </div>

            {outputFormat !== OutputFormat.Png &&
                !(
                    outputFormat === OutputFormat.Original &&
                    originalFormat === 'PNG'
                ) && (
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Quality: {quality}%
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="100"
                            value={quality}
                            onChange={(e) =>
                                onQualityChange(parseInt(e.target.value))
                            }
                            className="w-full"
                        />
                    </div>
                )}
        </>
    );
}
