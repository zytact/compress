type TabMode = 'dimensions' | 'filesize';

interface ModeTabsProps {
    value: TabMode;
    onChange: (mode: TabMode) => void;
}

export function ModeTabs({ value, onChange }: ModeTabsProps) {
    return (
        <div className="border-b border-border">
            <div className="flex gap-4">
                <button
                    type="button"
                    onClick={() => onChange('dimensions')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                        value === 'dimensions'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                    By Dimensions
                </button>
                <button
                    type="button"
                    onClick={() => onChange('filesize')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                        value === 'filesize'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                    By File Size
                </button>
            </div>
        </div>
    );
}
