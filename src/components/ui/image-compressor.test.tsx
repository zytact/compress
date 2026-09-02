import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImageCompressor from './image-compressor';

(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const wasmMocks = vi.hoisted(() => ({
    fileToUint8Array: vi.fn(),
    resizeByDimensions: vi.fn(),
    resizeByFilesize: vi.fn(),
}));

vi.mock('@/lib/wasm', () => ({
    OutputFormat: {
        Jpeg: 0,
        Png: 1,
        Original: 2,
    },
    convertHeicToJpeg: vi.fn(),
    fileToUint8Array: wasmMocks.fileToUint8Array,
    formatBytes: (bytes: number) => `${bytes} Bytes`,
    getFileExtension: () => 'jpg',
    getImageDimensionsFromUrl: vi.fn((url: string) =>
        Promise.resolve(
            url === 'blob:mock-1'
                ? { width: 800, height: 600 }
                : { width: 400, height: 300 },
        ),
    ),
    getMimeType: () => 'image/jpeg',
    inferFormatFromFilename: () => 'JPEG',
    replaceFileExtension: (filename: string) => filename,
    resizeByDimensions: wasmMocks.resizeByDimensions,
    resizeByFilesize: wasmMocks.resizeByFilesize,
    uint8ArrayToBlob: (data: Uint8Array, mimeType: string) =>
        new Blob([new Uint8Array(data)], { type: mimeType }),
}));

vi.mock('./slider', () => ({
    Slider: () => null,
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((promiseResolve) => {
        resolve = promiseResolve;
    });
    return { promise, resolve };
}

function selectImage(container: HTMLElement) {
    const input = container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
        throw new Error('File input not found');
    }

    fireEvent.change(input, {
        target: {
            files: [new File(['image'], 'photo.jpg', { type: 'image/jpeg' })],
        },
    });
}

describe('ImageCompressor live updates', () => {
    afterEach(cleanup);

    beforeEach(() => {
        let objectUrlId = 0;
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn(() => `blob:mock-${++objectUrlId}`),
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: vi.fn(),
        });
        wasmMocks.resizeByDimensions.mockReset();
        wasmMocks.resizeByFilesize.mockReset();
        wasmMocks.fileToUint8Array.mockReset();
        wasmMocks.fileToUint8Array.mockResolvedValue(new Uint8Array([1, 2, 3]));
        wasmMocks.resizeByDimensions.mockResolvedValue(new Uint8Array([1, 2]));
        wasmMocks.resizeByFilesize.mockResolvedValue(new Uint8Array([1, 2]));
    });

    it('compresses automatically and debounces setting changes', async () => {
        const { container } = render(<ImageCompressor />);
        selectImage(container);

        await waitFor(() =>
            expect(wasmMocks.resizeByDimensions).toHaveBeenCalledTimes(1),
        );

        const widthInput = screen.getAllByRole('spinbutton')[0];
        fireEvent.change(widthInput, { target: { value: '640' } });
        fireEvent.change(widthInput, { target: { value: '400' } });

        expect(wasmMocks.resizeByDimensions).toHaveBeenCalledTimes(1);
        await waitFor(() =>
            expect(wasmMocks.resizeByDimensions).toHaveBeenCalledTimes(2),
        );
        expect(wasmMocks.resizeByDimensions).toHaveBeenLastCalledWith(
            expect.any(Uint8Array),
            expect.objectContaining({ width: 400, height: 300 }),
        );
        expect(await screen.findByText('Preview is up to date')).not.toBeNull();
    });

    it('reports source loading before compression can start', async () => {
        const sourceRead = deferred<Uint8Array>();
        wasmMocks.fileToUint8Array.mockReturnValueOnce(sourceRead.promise);

        const { container } = render(<ImageCompressor />);
        selectImage(container);

        expect(await screen.findByText('Reading image...')).not.toBeNull();
        expect(screen.getByText('Preparing source image...')).not.toBeNull();

        await act(() => {
            sourceRead.resolve(new Uint8Array([1, 2, 3]));
        });
        await waitFor(() =>
            expect(wasmMocks.resizeByDimensions).toHaveBeenCalledTimes(1),
        );
    });

    it('ignores an older compression result that finishes last', async () => {
        const firstCompression = deferred<Uint8Array>();
        const secondCompression = deferred<Uint8Array>();
        wasmMocks.resizeByDimensions
            .mockReturnValueOnce(firstCompression.promise)
            .mockReturnValueOnce(secondCompression.promise);

        const { container } = render(<ImageCompressor />);
        selectImage(container);
        await waitFor(() =>
            expect(wasmMocks.resizeByDimensions).toHaveBeenCalledTimes(1),
        );

        fireEvent.change(screen.getAllByRole('spinbutton')[0], {
            target: { value: '400' },
        });
        await waitFor(() =>
            expect(wasmMocks.resizeByDimensions).toHaveBeenCalledTimes(2),
        );

        await act(() => {
            secondCompression.resolve(new Uint8Array([2, 2, 2]));
        });
        const currentPreview = await screen.findByAltText('Compressed');
        expect(currentPreview.getAttribute('src')).toBe('blob:mock-2');

        await act(() => {
            firstCompression.resolve(new Uint8Array([1]));
        });
        expect(screen.getByAltText('Compressed').getAttribute('src')).toBe(
            'blob:mock-2',
        );
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-3');
    });

    it('updates automatically in file-size mode', async () => {
        const { container } = render(<ImageCompressor />);
        selectImage(container);
        await waitFor(() =>
            expect(wasmMocks.resizeByDimensions).toHaveBeenCalledTimes(1),
        );

        fireEvent.click(screen.getByRole('button', { name: 'By File Size' }));
        await waitFor(() =>
            expect(wasmMocks.resizeByFilesize).toHaveBeenCalledTimes(1),
        );
        expect(wasmMocks.resizeByFilesize).toHaveBeenLastCalledWith(
            expect.any(Uint8Array),
            expect.objectContaining({ targetBytes: 500 * 1024 }),
        );

        fireEvent.change(screen.getByRole('spinbutton'), {
            target: { value: '250' },
        });
        await waitFor(() =>
            expect(wasmMocks.resizeByFilesize).toHaveBeenCalledTimes(2),
        );
        expect(wasmMocks.resizeByFilesize).toHaveBeenLastCalledWith(
            expect.any(Uint8Array),
            expect.objectContaining({ targetBytes: 250 * 1024 }),
        );
    });
});
