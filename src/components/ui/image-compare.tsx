import { useCallback, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface ImageCompareProps {
    originalUrl: string;
    resultUrl: string | null;
    updating: boolean;
}

const KEY_STEPS: Partial<Record<string, number>> = {
    ArrowLeft: -2,
    ArrowRight: 2,
    ArrowDown: -2,
    ArrowUp: 2,
    PageDown: -10,
    PageUp: 10,
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

export function ImageCompare({
    originalUrl,
    resultUrl,
    updating,
}: ImageCompareProps) {
    const [split, setSplit] = useState(50);
    const frameRef = useRef<HTMLDivElement>(null);

    const moveTo = useCallback((clientX: number) => {
        const frame = frameRef.current;
        if (!frame) return;
        const { left, width } = frame.getBoundingClientRect();
        setSplit(clampPercent(((clientX - left) / width) * 100));
    }, []);

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        moveTo(event.clientX);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        moveTo(event.clientX);
    };

    return (
        <div
            ref={frameRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            className="relative touch-none overflow-hidden rounded-xl border border-border bg-muted select-none"
        >
            <img
                src={originalUrl}
                alt="Original"
                draggable={false}
                className="block h-auto w-full"
            />

            {resultUrl && (
                <img
                    src={resultUrl}
                    alt="Compressed"
                    draggable={false}
                    style={{ clipPath: `inset(0 0 0 ${split}%)` }}
                    className={`absolute inset-0 h-full w-full object-fill transition-opacity duration-200 ${
                        updating ? 'opacity-40' : 'opacity-100'
                    }`}
                />
            )}

            <Caption side="left" tone="source" hidden={split < 14}>
                Original
            </Caption>
            <Caption side="right" tone="result" hidden={split > 86}>
                Compressed
            </Caption>

            {updating && (
                <span
                    role="status"
                    className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
                >
                    <Loader2 className="size-3.5 animate-spin" />
                    Compressing
                </span>
            )}

            <div
                role="slider"
                tabIndex={0}
                aria-label="Compare position"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(split)}
                aria-valuetext={`${Math.round(split)}% original`}
                onKeyDown={(event) => {
                    const step = KEY_STEPS[event.key];
                    if (step === undefined) return;
                    event.preventDefault();
                    setSplit((current) => clampPercent(current + step));
                }}
                style={{ left: `${split}%` }}
                className="group absolute inset-y-0 -ml-5 w-10 cursor-ew-resize focus-visible:outline-none"
            >
                <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-black/30" />
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-source to-result" />
                <span className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background">
                    <span className="h-3 w-px bg-source" />
                    <span className="mx-1 h-4 w-px bg-foreground/30" />
                    <span className="h-3 w-px bg-result" />
                </span>
            </div>
        </div>
    );
}

function Caption({
    side,
    tone,
    hidden,
    children,
}: {
    side: 'left' | 'right';
    tone: 'source' | 'result';
    hidden: boolean;
    children: string;
}) {
    return (
        <span
            className={`pointer-events-none absolute top-3 rounded-full bg-background/85 px-2.5 py-1 font-mono text-[0.6875rem] tracking-widest uppercase backdrop-blur-sm transition-opacity ${
                side === 'left' ? 'left-3' : 'right-3'
            } ${tone === 'source' ? 'text-source' : 'text-result'} ${
                hidden ? 'opacity-0' : 'opacity-100'
            }`}
        >
            {children}
        </span>
    );
}
