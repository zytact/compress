import { formatBytes } from '@/lib/wasm';

interface ByteBarProps {
    originalSize: number;
    resultSize: number | null;
}

export function ByteBar({ originalSize, resultSize }: ByteBarProps) {
    const ratio = resultSize === null ? 1 : resultSize / originalSize;
    const grew = ratio > 1;
    const changePercent = Math.round((1 - ratio) * 100);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="flex items-end gap-3 font-mono">
                    <Figure label="Original" tone="source">
                        {formatBytes(originalSize)}
                    </Figure>
                    <span className="pb-0.5 text-muted-foreground">&rarr;</span>
                    <Figure label="Compressed" tone="result">
                        {resultSize === null
                            ? '\u2026'
                            : formatBytes(resultSize)}
                    </Figure>
                </div>

                <p
                    className={`text-right ${grew ? 'text-signal' : 'text-result'}`}
                >
                    <span className="block font-mono text-4xl leading-none font-bold tracking-tight tabular-nums sm:text-5xl">
                        {resultSize === null
                            ? '\u2026'
                            : `${Math.abs(changePercent)}%`}
                    </span>
                    <span className="block text-[0.6875rem] tracking-widest uppercase">
                        {resultSize === null || !grew ? 'smaller' : 'larger'}
                    </span>
                </p>
            </div>

            <div
                className="h-2 overflow-hidden rounded-full bg-source-soft"
                role="img"
                aria-label={
                    resultSize === null
                        ? 'Compressing'
                        : `${formatBytes(resultSize)} of the original ${formatBytes(originalSize)}`
                }
            >
                <div
                    style={{ width: `${Math.min(100, ratio * 100)}%` }}
                    className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                        grew ? 'bg-signal' : 'bg-result'
                    }`}
                />
            </div>
        </div>
    );
}

function Figure({
    label,
    tone,
    children,
}: {
    label: string;
    tone: 'source' | 'result';
    children: string;
}) {
    return (
        <span className="block">
            <span
                className={`block text-[0.6875rem] tracking-widest uppercase ${
                    tone === 'source' ? 'text-source' : 'text-result'
                }`}
            >
                {label}
            </span>
            <span className="block text-lg font-medium tabular-nums">
                {children}
            </span>
        </span>
    );
}
