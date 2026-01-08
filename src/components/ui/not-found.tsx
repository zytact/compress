'use client';

import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export function NotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center px-4">
            <div className="text-center">
                <h1 className="text-6xl font-bold">404</h1>
                <h2 className="mt-4 text-2xl font-semibold">Page Not Found</h2>
                <p className="mt-2 text-muted-foreground">
                    The page you're looking for doesn't exist.
                </p>
                <Button asChild className="mt-6">
                    <Link to="/">Go Home</Link>
                </Button>
            </div>
        </div>
    );
}
