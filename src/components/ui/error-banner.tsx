interface ErrorBannerProps {
    message: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
    return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
            {message}
        </div>
    )
}
