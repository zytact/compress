type TabMode = 'dimensions' | 'filesize'

interface ModeTabsProps {
    value: TabMode
    onChange: (mode: TabMode) => void
}

export function ModeTabs({ value, onChange }: ModeTabsProps) {
    return (
        <div className="border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex gap-4">
                <button
                    onClick={() => onChange('dimensions')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                        value === 'dimensions'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                >
                    By Dimensions
                </button>
                <button
                    onClick={() => onChange('filesize')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                        value === 'filesize'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                >
                    By File Size
                </button>
            </div>
        </div>
    )
}
