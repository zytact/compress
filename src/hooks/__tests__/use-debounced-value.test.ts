// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from '../use-debounced-value';

describe('useDebouncedValue', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('emits only the last value of a burst', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value, 300),
            { initialProps: { value: 1 } },
        );

        rerender({ value: 2 });
        act(() => void vi.advanceTimersByTime(200));
        rerender({ value: 3 });
        act(() => void vi.advanceTimersByTime(200));
        expect(result.current).toBe(1);

        act(() => void vi.advanceTimersByTime(100));
        expect(result.current).toBe(3);
    });
});
