import { useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';

import { Button } from './button';

interface FileDropzoneProps {
    onFileSelect: (file: File) => void;
    compact?: boolean;
    accept?: string;
}

export function FileDropzone({
    onFileSelect,
    compact = false,
    accept = 'image/jpeg,image/png,image/heic,image/heif,.heic,.heif',
}: FileDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const input = (
        <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) onFileSelect(file);
            }}
            className="hidden"
        />
    );

    if (compact) {
        return (
            <>
                {input}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                >
                    <ImageUp />
                    Replace image
                </Button>
            </>
        );
    }

    return (
        <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const { files } = event.dataTransfer;
                if (files.length > 0) onFileSelect(files[0]);
            }}
            className={`w-full rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                dragging
                    ? 'border-result bg-result-soft'
                    : 'border-border hover:border-muted-foreground'
            }`}
        >
            {input}
            <ImageUp
                aria-hidden
                className="mx-auto mb-4 size-7 text-muted-foreground"
            />
            <p className="text-lg font-medium">
                Drop an image here, or click to pick one
            </p>
            <p className="mt-1 font-mono text-xs tracking-widest text-muted-foreground uppercase">
                JPEG &middot; PNG &middot; HEIC
            </p>
        </button>
    );
}
