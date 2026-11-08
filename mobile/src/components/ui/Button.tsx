import React from 'react';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import s from '../../constants/styles';
import { colors } from '../../constants/colors';
import Icon, { type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'yellow' | 'scan' | 'danger' | 'text';

const variants: Record<ButtonVariant, { box: object; text: object; iconColor: string }> = {
    primary: { box: s.primaryButton, text: s.primaryButtonText, iconColor: colors.white },
    secondary: { box: s.secondaryButton, text: s.secondaryButtonText, iconColor: colors.primary },
    yellow: { box: s.yellowButton, text: s.yellowButtonText, iconColor: colors.yellowText },
    scan: { box: s.scanHomeButton, text: s.scanHomeText, iconColor: colors.white },
    danger: { box: s.dangerButton, text: s.dangerText, iconColor: colors.danger },
    text: { box: s.textButton, text: s.textButtonLabel, iconColor: colors.primary },
};

type Props = {
    label: string;
    onPress?: () => void;
    variant?: ButtonVariant;
    icon?: IconName;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
};

/** App button in one of the WareGo styles. */
export default function Button({ label, onPress, variant = 'primary', icon, disabled, style }: Props) {
    const v = variants[variant];
    return (
        <Pressable accessibilityRole="button" style={[v.box, disabled && s.buttonDisabled, style]} disabled={disabled} onPress={onPress}>
            <Text style={v.text}>
                {icon ? <><Icon name={icon} size={17} color={v.iconColor} />{'  '}</> : null}
                {label}
            </Text>
        </Pressable>
    );
}
