import { cn } from '@/lib/utils';

const LETTERS = [...'compress'];

const trackingEm = (index: number) =>
    `${(0.12 - (index / (LETTERS.length - 1)) * 0.19).toFixed(3)}em`;

export function Wordmark({ className }: { className?: string }) {
    return (
        <span
            aria-label="compress"
            className={cn(
                'font-display font-extrabold lowercase select-none',
                className,
            )}
        >
            {LETTERS.map((letter, index) => (
                <span
                    key={index}
                    aria-hidden
                    style={{ letterSpacing: trackingEm(index) }}
                >
                    {letter}
                </span>
            ))}
        </span>
    );
}
