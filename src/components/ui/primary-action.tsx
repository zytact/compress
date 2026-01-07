interface PrimaryActionProps {
    onClick: () => void
    loading: boolean
    disabled?: boolean
}

export function PrimaryAction({
    onClick,
    loading,
    disabled = false,
}: PrimaryActionProps) {
    return (
        <button
            onClick={onClick}
            disabled={loading || disabled}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium py-3 rounded-lg transition-colors"
        >
            {loading ? 'Processing...' : 'Compress Image'}
        </button>
    )
}
