interface FilesizeSettingsProps {
    targetSize: number;
    onTargetSizeChange: (value: number) => void;
}

export function FilesizeSettings({
    targetSize,
    onTargetSizeChange,
}: FilesizeSettingsProps) {
    return (
        <div>
            <label className="block text-sm font-medium mb-2">
                Target File Size (KB)
            </label>
            <input
                type="number"
                value={targetSize}
                onChange={(e) =>
                    onTargetSizeChange(parseInt(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-input rounded-lg bg-background"
            />
            <p className="mt-2 text-sm text-muted-foreground">
                Output will be JPEG format. Binary search will find optimal
                quality.
            </p>
        </div>
    );
}
