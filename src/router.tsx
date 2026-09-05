import { createRouter } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';
import { NotFound } from '@/components/ui/not-found';

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
