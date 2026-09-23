import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Slider } from './slider';
import type {
    Dispatch,
    KeyboardEvent as ReactKeyboardEvent,
    PointerEvent as ReactPointerEvent,
    SetStateAction,
} from 'react';

import type { CropRect, Framing } from '@/lib/crop';
import { MAX_ZOOM, clampZoom, frameCrop } from '@/lib/crop';

interface CropEditorProps {
    imageUrl: string;
    sourceWidth: number;
    sourceHeight: number;
    framing: Framing;
    crop: CropRect;
    onFramingChange: Dispatch<SetStateAction<Framing>>;
    /** Output size, shown on the crop box. */
    outputLabel: string;
    /** The compressed crop, or `null` while none matches the current crop. */
    resultUrl: string | null;
    updating: boolean;
}

// Room around the crop box, so what gets cut stays visible
const BOX_FILL = 0.88;
const KEY_PAN = 0.05;
const KEY_ZOOM = 1.1;
const WHEEL_ZOOM = 0.0015;

// Space shows the original, except where it already means something
const ownsSpace = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest(
        'input, textarea, select, button, [contenteditable], [role=slider], [role=radio]',
    ) !== null;

/**
 * The crop box over the source, showing the compressed result inside it. The
 * box stays put and the picture moves under it: drag to pan, scroll or use the
 * slider to zoom, hold the button or Space to see the original.
 */
export function CropEditor({
    imageUrl,
    sourceWidth,
    sourceHeight,
    framing,
    crop,
    onFramingChange,
    outputLabel,
    resultUrl,
    updating,
}: CropEditorProps) {
    const stageRef = useRef<HTMLDivElement>(null);
    const panRef = useRef<{
        pointerX: number;
        pointerY: number;
        centerX: number;
        centerY: number;
        sourcePerPixel: number;
    } | null>(null);
    const [holding, setHolding] = useState(false);

    // A wide crop gets a wide stage instead of empty bars. Positions are in
    // percent of the stage width, and `stageHeight` in the same units
    const aspect = crop.width / crop.height;
    const stageHeight = 100 / Math.max(4 / 3, aspect / BOX_FILL);
    const boxWidth = Math.min(100 * BOX_FILL, stageHeight * BOX_FILL * aspect);
    const boxHeight = boxWidth / aspect;
    const boxLeft = (100 - boxWidth) / 2;
    const boxTop = (stageHeight - boxHeight) / 2;
    // Stage units per source pixel
    const scale = boxWidth / crop.width;
    const vertical = (units: number) => `${(units / stageHeight) * 100}%`;
    const boxStyle = {
        left: `${boxLeft}%`,
        top: vertical(boxTop),
        width: `${boxWidth}%`,
        height: vertical(boxHeight),
    };

    // Moving past an edge would park the centre where the crop cannot follow,
    // so store where the crop actually landed
    const moveTo = (centerX: number, centerY: number) => {
        const next = frameCrop(
            { ...framing, centerX, centerY },
            sourceWidth,
            sourceHeight,
        );
        onFramingChange({
            ...framing,
            centerX: next.x + next.width / 2,
            centerY: next.y + next.height / 2,
        });
    };

    const zoomTo = (zoom: number) =>
        onFramingChange({ ...framing, zoom: clampZoom(zoom) });

    // React registers wheel listeners as passive, and the page must not scroll
    // while the wheel zooms. Wheel events can outpace renders, so each one
    // builds on the latest zoom rather than the one this render saw
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            onFramingChange((current) => ({
                ...current,
                zoom: clampZoom(
                    current.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM),
                ),
            }));
        };
        stage.addEventListener('wheel', onWheel, { passive: false });
        return () => stage.removeEventListener('wheel', onWheel);
    }, [onFramingChange]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.code !== 'Space' || ownsSpace(event.target)) return;
            event.preventDefault();
            setHolding(true);
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.code === 'Space') setHolding(false);
        };
        // A key released in another window never reaches this one
        const release = () => setHolding(false);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', release);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', release);
        };
    }, []);

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const stageWidth = event.currentTarget.getBoundingClientRect().width;
        panRef.current = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            centerX: crop.x + crop.width / 2,
            centerY: crop.y + crop.height / 2,
            sourcePerPixel: 100 / (stageWidth * scale),
        };
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const pan = panRef.current;
        if (!pan || !event.currentTarget.hasPointerCapture(event.pointerId)) {
            return;
        }
        moveTo(
            pan.centerX - (event.clientX - pan.pointerX) * pan.sourcePerPixel,
            pan.centerY - (event.clientY - pan.pointerY) * pan.sourcePerPixel,
        );
    };

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const centerX = crop.x + crop.width / 2;
        const centerY = crop.y + crop.height / 2;
        const stepX = crop.width * KEY_PAN;
        const stepY = crop.height * KEY_PAN;

        const actions: Partial<Record<string, () => void>> = {
            ArrowLeft: () => moveTo(centerX - stepX, centerY),
            ArrowRight: () => moveTo(centerX + stepX, centerY),
            ArrowUp: () => moveTo(centerX, centerY - stepY),
            ArrowDown: () => moveTo(centerX, centerY + stepY),
            '+': () => zoomTo(framing.zoom * KEY_ZOOM),
            '=': () => zoomTo(framing.zoom * KEY_ZOOM),
            '-': () => zoomTo(framing.zoom / KEY_ZOOM),
        };
        const action = actions[event.key];
        if (!action) return;
        event.preventDefault();
        action();
    };

    const showingResult = resultUrl !== null && !holding;
    const holdKeys = ['Enter', ' '];

    return (
        <div className="space-y-3">
            <div
                ref={stageRef}
                role="group"
                tabIndex={0}
                aria-label="Crop position. Drag or use the arrow keys to move the image, scroll or press plus and minus to zoom."
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={() => (panRef.current = null)}
                onPointerCancel={() => (panRef.current = null)}
                onKeyDown={handleKeyDown}
                style={{ aspectRatio: `100 / ${stageHeight}` }}
                className="relative cursor-grab touch-none overflow-hidden rounded-none border border-border bg-muted select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
            >
                <img
                    src={imageUrl}
                    alt="Original"
                    draggable={false}
                    className="pointer-events-none absolute max-w-none"
                    style={{
                        left: `${boxLeft - crop.x * scale}%`,
                        top: vertical(boxTop - crop.y * scale),
                        width: `${sourceWidth * scale}%`,
                        height: vertical(sourceHeight * scale),
                    }}
                />
                {resultUrl && (
                    <img
                        src={resultUrl}
                        alt="Compressed"
                        draggable={false}
                        style={boxStyle}
                        className={`pointer-events-none absolute max-w-none transition-opacity duration-200 ${
                            holding
                                ? 'invisible'
                                : updating
                                  ? 'opacity-40'
                                  : 'opacity-100'
                        }`}
                    />
                )}
                <div
                    className="pointer-events-none absolute shadow-[0_0_0_9999px_rgb(0_0_0/0.6)] outline outline-white"
                    style={boxStyle}
                >
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                        {Array.from({ length: 9 }, (_, index) => (
                            <span
                                key={index}
                                className="border-r border-b border-white/20"
                            />
                        ))}
                    </div>
                    <Chip className="top-2 left-2 text-white/80">
                        {outputLabel}
                    </Chip>
                    <Chip
                        className={`top-2 right-2 ${showingResult ? 'text-result' : 'text-source'}`}
                    >
                        {showingResult ? 'Compressed' : 'Original'}
                    </Chip>
                </div>

                {updating && (
                    <span
                        role="status"
                        className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-2 rounded-none bg-background/85 px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
                    >
                        <Loader2 className="size-3.5 animate-spin" />
                        Compressing
                    </span>
                )}
            </div>

            <div className="flex items-center gap-3">
                <span className="shrink-0 text-sm text-muted-foreground">
                    Zoom
                </span>
                <Slider
                    aria-label="Zoom"
                    min={1}
                    max={MAX_ZOOM}
                    step={0.01}
                    value={[framing.zoom]}
                    onValueChange={([next]) => zoomTo(next)}
                />
                <span className="w-12 shrink-0 text-right font-mono text-sm tabular-nums">
                    {Math.round(framing.zoom * 100)}%
                </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                    Drag the image to move it. Scroll or use the slider to zoom.
                </p>
                <button
                    type="button"
                    onPointerDown={() => setHolding(true)}
                    onPointerUp={() => setHolding(false)}
                    onPointerLeave={() => setHolding(false)}
                    onPointerCancel={() => setHolding(false)}
                    onKeyDown={(event) => {
                        if (!holdKeys.includes(event.key)) return;
                        event.preventDefault();
                        setHolding(true);
                    }}
                    onKeyUp={(event) => {
                        if (holdKeys.includes(event.key)) setHolding(false);
                    }}
                    className="flex items-center gap-2 rounded-none border border-border bg-card px-3 py-1.5 text-sm font-medium select-none hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:bg-muted"
                >
                    Hold to see original
                    <kbd className="border border-border px-1 font-mono text-[0.625rem] text-muted-foreground">
                        Space
                    </kbd>
                </button>
            </div>
        </div>
    );
}

function Chip({
    className,
    children,
}: {
    className: string;
    children: string;
}) {
    return (
        <span
            className={`absolute rounded-none bg-black/70 px-2 py-0.5 font-mono text-[0.6875rem] tracking-widest uppercase ${className}`}
        >
            {children}
        </span>
    );
}
