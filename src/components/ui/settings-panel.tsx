import { Loader2 } from 'lucide-react';

import { NumberInput } from './number-input';
import { Segmented } from './segmented';
import { Slider } from './slider';
import { Button } from './button';
import type { SourceFormat } from '@/lib/wasm';
import { OutputFormat } from '@/lib/wasm';
import { usesQuality } from '@/lib/compress';

interface SettingsPanelProps {
    originalWidth: number;
    originalFormat: SourceFormat | null;
    width: number;
    height: number;
    onWidthChange: (width: number) => void;
    format: OutputFormat;
    onFormatChange: (format: OutputFormat) => void;
    quality: number;
    onQualityChange: (quality: number) => void;
    targetKb: number;
    onTargetKbChange: (targetKb: number) => void;
    onFit: () => void;
    fitting: boolean;
    fitNote: string | null;
}

const SCALES = [1, 0.75, 0.5, 0.25];

const scaledWidth = (originalWidth: number, scale: number) =>
    Math.max(1, Math.round(originalWidth * scale));

export function SettingsPanel({
    originalWidth,
    originalFormat,
    width,
    height,
    onWidthChange,
    format,
    onFormatChange,
    quality,
    onQualityChange,
    targetKb,
    onTargetKbChange,
    onFit,
    fitting,
    fitNote,
}: SettingsPanelProps) {
    const activeScale =
        SCALES.find((scale) => scaledWidth(originalWidth, scale) === width) ??
        null;
    const jpegOut = usesQuality(format, originalFormat);

    return (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
            <Section title="Size" readout={`${width} × ${height} px`}>
                <Segmented
                    label="Scale"
                    value={activeScale}
                    options={SCALES.map((scale) => ({
                        value: scale,
                        label: `${scale * 100}%`,
                    }))}
                    onChange={(scale) =>
                        onWidthChange(scaledWidth(originalWidth, scale))
                    }
                />
                <label className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-sm text-muted-foreground">
                        Width
                    </span>
                    <NumberInput
                        value={width}
                        onValueChange={(next) =>
                            onWidthChange(Math.min(next, originalWidth))
                        }
                    />
                    <span className="shrink-0 font-mono text-sm text-muted-foreground">
                        px
                    </span>
                </label>
                <p className="text-xs text-muted-foreground">
                    Height follows the width. Enlarging past {originalWidth} px
                    would only invent pixels, so it stops there.
                </p>
            </Section>

            <Section title="Format">
                <Segmented
                    label="Output format"
                    value={format}
                    options={[
                        ...(originalFormat === 'HEIC'
                            ? []
                            : [
                                  {
                                      value: OutputFormat.Original,
                                      label: 'Keep original',
                                  },
                              ]),
                        { value: OutputFormat.Jpeg, label: 'JPEG' },
                        { value: OutputFormat.Png, label: 'PNG' },
                    ]}
                    onChange={onFormatChange}
                />
            </Section>

            {jpegOut ? (
                <>
                    <Section title="Quality" readout={String(quality)}>
                        <Slider
                            aria-label="Quality"
                            min={1}
                            max={100}
                            step={1}
                            value={[quality]}
                            onValueChange={([next]) => onQualityChange(next)}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Smaller file</span>
                            <span>Sharper picture</span>
                        </div>
                    </Section>

                    <Section title="Fit to a size">
                        <div className="flex items-center gap-3">
                            <NumberInput
                                aria-label="Target size in kilobytes"
                                value={targetKb}
                                onValueChange={onTargetKbChange}
                            />
                            <span className="shrink-0 font-mono text-sm text-muted-foreground">
                                KB
                            </span>
                            <Button
                                variant="outline"
                                onClick={onFit}
                                disabled={fitting || targetKb <= 0}
                                className="shrink-0"
                            >
                                {fitting && (
                                    <Loader2 className="animate-spin" />
                                )}
                                Fit
                            </Button>
                        </div>
                        <p
                            role="status"
                            className="text-xs text-muted-foreground"
                        >
                            {fitNote ??
                                'Or name a size and let it pick the quality that lands just under.'}
                        </p>
                    </Section>
                </>
            ) : (
                <Section title="Quality">
                    <p className="text-sm text-muted-foreground">
                        PNG keeps every pixel exactly as it is, so there is no
                        quality to trade. Switch to JPEG to trade detail for
                        bytes, or to fit a target size.
                    </p>
                </Section>
            )}
        </div>
    );
}

function Section({
    title,
    readout,
    children,
}: {
    title: string;
    readout?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-3 p-4">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[0.6875rem] font-medium tracking-widest text-muted-foreground uppercase">
                    {title}
                </h2>
                {readout && (
                    <span className="font-mono text-sm tabular-nums">
                        {readout}
                    </span>
                )}
            </div>
            {children}
        </section>
    );
}
