import { useEffect, useRef } from 'react';
import { Slider } from './slider';
import type {
    Dispatch,
    KeyboardEvent as ReactKeyboardEvent,
    PointerEvent as ReactPointerEvent,
    SetStateAction,
} from 'react';

import type { CropRect, Framing } from '@/lib/crop';
import { MAX_ZOOM, clampZoom, frameCrop } from '@/lib/crop';

interface FrameEditorProps {
    imageUrl: string;
    sourceWidth: number;
    sourceHeight: number;
    framing: Framing;
    crop: CropRect;
    onFramingChange: Dispatch<SetStateAction<Framing>>;
    /** Output size, printed above the frame. */
    outputLabel: string;
}

// The stage is 4:3, measured in percent of its width
const STAGE_HEIGHT = 75;
// Room around the frame, so what gets cut stays visible
const FRAME_FILL = 0.88;
const KEY_PAN = 0.05;
const KEY_ZOOM = 1.1;
const WHEEL_ZOOM = 0.0015;

/**
 * The output frame over the source. The frame stays put and the picture moves
 * under it: drag to pan, scroll or use the slider to zoom.
 */
export function FrameEditor({
    imageUrl,
    sourceWidth,
    sourceHeight,
    framing,
    crop,
    onFramingChange,
    outputLabel,
}: FrameEditorProps) {
    const stageRef = useRef<HTMLDivElement>(null);
    const panRef = useRef<{
        pointerX: number;
        pointerY: number;
        centerX: number;
        centerY: number;
        sourcePerPixel: number;
    } | null>(null);

    const aspect = crop.width / crop.height;
    const frameWidth = Math.min(
        100 * FRAME_FILL,
        STAGE_HEIGHT * FRAME_FILL * aspect,
    );
    const frameHeight = frameWidth / aspect;
    const frameLeft = (100 - frameWidth) / 2;
    const frameTop = (STAGE_HEIGHT - frameHeight) / 2;
    // Stage units per source pixel
    const scale = frameWidth / crop.width;
    const vertical = (units: number) => `${(units / STAGE_HEIGHT) * 100}%`;

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

    return (
        <div className="space-y-3">
            <div
                ref={stageRef}
                role="group"
                tabIndex={0}
                aria-label="Frame position. Drag or use the arrow keys to move the picture, scroll or press plus and minus to zoom."
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={() => (panRef.current = null)}
                onPointerCancel={() => (panRef.current = null)}
                onKeyDown={handleKeyDown}
                style={{ aspectRatio: `100 / ${STAGE_HEIGHT}` }}
                className="relative cursor-grab touch-none overflow-hidden rounded-none border border-border bg-muted select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
            >
                <img
                    src={imageUrl}
                    alt="Original"
                    draggable={false}
                    className="pointer-events-none absolute max-w-none"
                    style={{
                        left: `${frameLeft - crop.x * scale}%`,
                        top: vertical(frameTop - crop.y * scale),
                        width: `${sourceWidth * scale}%`,
                        height: vertical(sourceHeight * scale),
                    }}
                />
                <div
                    className="pointer-events-none absolute shadow-[0_0_0_9999px_rgb(0_0_0/0.6)] outline outline-white"
                    style={{
                        left: `${frameLeft}%`,
                        top: vertical(frameTop),
                        width: `${frameWidth}%`,
                        height: vertical(frameHeight),
                    }}
                >
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                        {Array.from({ length: 9 }, (_, index) => (
                            <span
                                key={index}
                                className="border-r border-b border-white/20"
                            />
                        ))}
                    </div>
                    <span className="absolute bottom-full left-0 mb-1.5 font-mono text-[0.6875rem] tracking-widest text-white/80">
                        {outputLabel}
                    </span>
                </div>
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
        </div>
    );
}
