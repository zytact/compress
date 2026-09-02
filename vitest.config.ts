import { defineConfig } from 'vitest/config';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';

// Tests run without the TanStack Start plugin: its server conditions resolve a
// second React copy, which breaks hooks under @testing-library/react.
export default defineConfig({
    plugins: [
        viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
        viteReact(),
    ],
    test: {
        environment: 'node',
    },
});
