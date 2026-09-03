import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';

import appCss from '../styles.css?url';
import { ThemeProvider } from '@/components/theme-provider';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { Wordmark } from '@/components/ui/wordmark';

export const Route = createRootRoute({
    head: () => ({
        meta: [
            {
                charSet: 'utf-8',
            },
            {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1',
            },
            {
                title: 'Compress',
            },
            {
                name: 'description',
                content: 'Compress images right on the Browser',
            },
            // OpenGraph
            { property: 'og:title', content: 'Compress' },
            {
                property: 'og:description',
                content: 'Compress images right on the Browser',
            },
            { property: 'og:image', content: '/og-image.png' },
            { property: 'og:type', content: 'website' },
            // Twitter
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:image', content: '/og-image.png' },
        ],
        links: [
            { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
            {
                rel: 'preconnect',
                href: 'https://fonts.gstatic.com',
                crossOrigin: 'anonymous',
            },
            {
                rel: 'stylesheet',
                href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap',
            },
            {
                rel: 'stylesheet',
                href: appCss,
            },
        ],
    }),

    shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <HeadContent />
            </head>
            <body className="flex min-h-screen flex-col">
                <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
                    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                        <a
                            href="/"
                            className="rounded-none text-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <Wordmark />
                        </a>
                        <div className="flex items-center gap-3">
                            <a
                                href="https://github.com/zytact/compress"
                                aria-label="View source on GitHub"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                <img
                                    src="/GitHub_light.svg"
                                    alt=""
                                    className="block size-5 dark:hidden"
                                />
                                <img
                                    src="/GitHub_dark.svg"
                                    alt=""
                                    className="hidden size-5 dark:block"
                                />
                            </a>
                            <ModeToggle />
                        </div>
                    </header>
                    <main className="flex-1">{children}</main>
                    <footer className="py-6 text-center text-sm text-muted-foreground">
                        Made with ❤️ by{' '}
                        <a
                            href="https://zytact.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                            Arnab
                        </a>
                    </footer>
                </ThemeProvider>
                <TanStackDevtools
                    config={{
                        position: 'bottom-right',
                    }}
                    plugins={[
                        {
                            name: 'Tanstack Router',
                            render: <TanStackRouterDevtoolsPanel />,
                        },
                    ]}
                />
                <Scripts />
            </body>
        </html>
    );
}
