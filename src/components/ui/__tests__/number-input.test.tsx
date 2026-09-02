// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NumberInput } from '../number-input';

/** Mirrors the real callers: a numeric parent that may clamp what it is given. */
function Harness({ max }: { max?: number }) {
    const [value, setValue] = useState(1920);
    return (
        <NumberInput
            value={value}
            onValueChange={(next) =>
                setValue(max === undefined ? next : Math.min(next, max))
            }
        />
    );
}

const field = () => screen.getByRole<HTMLInputElement>('textbox');

describe('NumberInput', () => {
    afterEach(cleanup);

    it('stays empty when cleared instead of snapping to 0', () => {
        render(<Harness />);
        fireEvent.change(field(), { target: { value: '' } });
        expect(field().value).toBe('');
    });

    it('never displays a leading zero', () => {
        render(<Harness />);
        fireEvent.change(field(), { target: { value: '' } });
        fireEvent.change(field(), { target: { value: '011' } });
        expect(field().value).toBe('11');
    });

    it('ignores characters that are not digits', () => {
        render(<Harness />);
        fireEvent.change(field(), { target: { value: '1.5' } });
        expect(field().value).toBe('15');
    });

    it('shows the number again once the cleared field loses focus', () => {
        render(<Harness />);
        fireEvent.change(field(), { target: { value: '' } });
        fireEvent.blur(field());
        expect(field().value).toBe('0');
    });

    it('shows the parent value when the parent clamps the input', () => {
        render(<Harness max={4000} />);
        fireEvent.change(field(), { target: { value: '9999' } });
        expect(field().value).toBe('4000');
    });
});
