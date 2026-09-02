import { useState } from 'react';
import type { ComponentProps } from 'react';

interface NumberInputProps extends Omit<
    ComponentProps<'input'>,
    'value' | 'onChange' | 'onBlur' | 'type' | 'inputMode'
> {
    value: number;
    onValueChange: (value: number) => void;
}

/**
 * A whole-number field that can be emptied while typing. It is a text input on
 * purpose. React syncs `type="number"` inputs by numeric comparison, so a field
 * showing "011" for the number 11 is left alone and the stray digit sticks.
 */
export function NumberInput({
    value,
    onValueChange,
    ...props
}: NumberInputProps) {
    // An empty field is not a number, so it has to be remembered separately.
    const [empty, setEmpty] = useState(false);

    return (
        <input
            {...props}
            type="text"
            inputMode="numeric"
            value={empty && value === 0 ? '' : String(value)}
            onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setEmpty(digits === '');
                onValueChange(digits === '' ? 0 : parseInt(digits, 10));
            }}
            onBlur={() => setEmpty(false)}
        />
    );
}
