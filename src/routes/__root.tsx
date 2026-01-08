import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';

import appCss from '../styles.css?url';
import { ThemeProvider } from '@/components/theme-provider';
import { ModeToggle } from '@/components/ui/mode-toggle';

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
            <body className="flex flex-col min-h-screen">
                <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
                    <div className="absolute top-2 right-2 z-50 flex flex-col md:flex-row items-center gap-3">
                        <a
                            href="https://github.com/zytact/compress"
                            aria-label="View source on GitHub"
                            title="View Source Code"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="md:inline-block hidden"
                        >
                            {/* Light theme icon */}
                            <img
                                src="/GitHub_light.svg"
                                alt="GitHub"
                                className="h-6 w-6 block dark:hidden"
                            />
                            {/* Dark theme icon */}
                            <img
                                src="/GitHub_dark.svg"
                                alt="GitHub"
                                className="h-6 w-6 hidden dark:block"
                            />
                        </a>
                        <ModeToggle />
                        <a
                            href="https://github.com/zytact/compress"
                            aria-label="View source on GitHub"
                            title="View Source Code"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block md:hidden"
                        >
                            {/* Light theme icon */}
                            <img
                                src="/GitHub_light.svg"
                                alt="GitHub"
                                className="h-6 w-6 block dark:hidden"
                            />
                            {/* Dark theme icon */}
                            <img
                                src="/GitHub_dark.svg"
                                alt="GitHub"
                                className="h-6 w-6 hidden dark:block"
                            />
                        </a>
                    </div>
                    <div className="flex-1">{children}</div>
                    <footer className="py-4 text-center text-sm text-foreground/80">
                        <span>
                            Made with{' '}
                            <span className="text-red-500" aria-label="love">
                                ❤️
                            </span>{' '}
                            by{' '}
                        </span>
                        <a
                            href="https://zytact.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-foreground hover:text-foreground transition-colors"
                            aria-label="Visit Arnab's website"
                        >
                            <b>Arnab</b>
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
