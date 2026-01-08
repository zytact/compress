interface ErrorBannerProps {
    message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
    return (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-destructive-foreground">
            {message}
        </div>
    );
}
