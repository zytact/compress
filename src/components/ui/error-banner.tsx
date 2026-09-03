interface ErrorBannerProps {
    message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
    return (
        <p
            role="alert"
            className="rounded-none border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
            {message}
        </p>
    );
}
