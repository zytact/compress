//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config';

export default [
    ...tanstackConfig,
    {
        ignores: ['public/wasm/**', '.output/**', '*.config.js'],
    },
];
