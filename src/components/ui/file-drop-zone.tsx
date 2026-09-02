import { useRef } from 'react';

interface FileDropzoneProps {
    onFileSelect: (file: File) => void;
    accept?: string;
}

export function FileDropzone({
    onFileSelect,
    accept = 'image/jpeg,image/png,image/heic,image/heif,.heic,.heif',
}: FileDropzoneProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            onFileSelect(files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    return (
        <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-muted-foreground"
        >
            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={(e) =>
                    e.target.files?.[0] && onFileSelect(e.target.files[0])
                }
                className="hidden"
            />
            <div className="space-y-2">
                <div className="text-4xl">📁</div>
                <p className="text-lg font-medium">
                    Drop an image here or click to select
                </p>
                <p className="text-sm text-muted-foreground">
                    Supports JPEG, PNG, and HEIC (on supported devices)
                </p>
            </div>
        </div>
    );
}
