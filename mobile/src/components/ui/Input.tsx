import React from 'react';
import { Text, TextInput, type TextInputProps } from 'react-native';
import s from '../../constants/styles';

type Props = TextInputProps & { label?: string };

/** Text field with the app style and an optional uppercase label above it. */
export default function Input({ label, style, ...props }: Props) {
    return (
        <>
            {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
            <TextInput style={[s.input, style]} {...props} />
        </>
    );
}
