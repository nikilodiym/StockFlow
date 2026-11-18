import React from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useAppStyles } from '../../constants/styles';
import Icon, { type IconName } from './Icon';

type Props = TextInputProps & { label?: string; icon?: IconName };

/** Text field with the app style and an optional uppercase label above it. */
export default function Input({ label, icon, style, ...props }: Props) {
    const s = useAppStyles();

    return (
        <>
            {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
            <View>
                <TextInput
                    placeholderTextColor="#606876"
                    style={[s.input, icon && { paddingLeft: 48 }, style]}
                    {...props}
                />
                {icon && (
                    <View pointerEvents="none" style={{ position: 'absolute', left: 14, top: 13 }}>
                        <Icon name={icon} color="#606876" />
                    </View>
                )}
            </View>
        </>
    );
}
