import { Button } from './button';

interface PrimaryActionProps {
    onClick: () => void;
    loading: boolean;
    disabled?: boolean;
}

export function PrimaryAction({
    onClick,
    loading,
    disabled = false,
}: PrimaryActionProps) {
    return (
        <Button
            onClick={onClick}
            disabled={loading || disabled}
            className="w-full"
        >
            {loading ? 'Processing...' : 'Compress Image'}
        </Button>
    );
}
