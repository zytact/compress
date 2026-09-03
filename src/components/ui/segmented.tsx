interface SegmentedOption<T> {
    value: T;
    label: string;
}

interface SegmentedProps<T> {
    label: string;
    value: T | null;
    options: Array<SegmentedOption<T>>;
    onChange: (value: T) => void;
}

export function Segmented<T extends string | number>({
    label,
    value,
    options,
    onChange,
}: SegmentedProps<T>) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className="flex gap-1 rounded-none bg-muted p-1"
        >
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <button
                        key={String(option.value)}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(option.value)}
                        className={`flex-1 rounded-none px-2 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                            selected
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
