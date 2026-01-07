interface FilesizeSettingsProps {
    targetSize: number
    onTargetSizeChange: (value: number) => void
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
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
            />
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Output will be JPEG format. Binary search will find optimal
                quality.
            </p>
        </div>
    )
}
