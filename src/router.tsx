import { createRouter } from '@tanstack/react-router';

// Import the generated route tree
import { routeTree } from './routeTree.gen';
import { NotFound } from '@/components/ui/not-found';

// Create a new router instance
export const getRouter = () => {
    const router = createRouter({
        routeTree,
        context: {},
        defaultNotFoundComponent: NotFound,
        scrollRestoration: true,
        defaultPreloadStaleTime: 0,
    });

    return router;
};
