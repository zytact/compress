/** A rectangle of the source image, in source pixels. */
export interface CropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Where the output frame sits over the source. */
export interface Framing {
    /** Width over height of the frame, or `null` for the source's own shape. */
    aspect: number | null;
    /** 1 is the largest frame of that shape the source can fill. */
    zoom: number;
    /** Frame centre in source pixels. `frameCrop` pulls it back inside. */
    centerX: number;
    centerY: number;
}

export const MAX_ZOOM = 4;

export const clampZoom = (zoom: number) =>
    Math.min(MAX_ZOOM, Math.max(1, zoom));

export const centeredFraming = (
    aspect: number | null,
    sourceWidth: number,
    sourceHeight: number,
): Framing => ({
    aspect,
    zoom: 1,
    centerX: sourceWidth / 2,
    centerY: sourceHeight / 2,
});

/** The whole-pixel region of the source a framing keeps, always inside it. */
export function frameCrop(
    framing: Framing,
    sourceWidth: number,
    sourceHeight: number,
): CropRect {
    if (sourceWidth <= 0 || sourceHeight <= 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }

    const aspect = framing.aspect ?? sourceWidth / sourceHeight;
    const fullWidth = Math.min(sourceWidth, sourceHeight * aspect);
    const zoom = clampZoom(framing.zoom);
    const side = (full: number, source: number) =>
        Math.min(source, Math.max(1, Math.round(full / zoom)));

    const width = side(fullWidth, sourceWidth);
    const height = side(fullWidth / aspect, sourceHeight);
    const place = (center: number, size: number, source: number) =>
        Math.min(source - size, Math.max(0, Math.round(center - size / 2)));

    return {
        x: place(framing.centerX, width, sourceWidth),
        y: place(framing.centerY, height, sourceHeight),
        width,
        height,
    };
}

export const sameCrop = (a: CropRect, b: CropRect) =>
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export const coversSource = (
    crop: CropRect,
    sourceWidth: number,
    sourceHeight: number,
) => sameCrop(crop, { x: 0, y: 0, width: sourceWidth, height: sourceHeight });
