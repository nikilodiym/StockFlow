import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';
import Icon, { type IconName } from '../../../components/ui/Icon';
import Switch from '../../../components/ui/Switch';
type Props = {
    title: string;
    subtitle?: string;
    icon?: IconName;
    value: boolean;
    onToggle: () => void;
    inset?: boolean;
};
export default function SettingRow({ title, subtitle, icon, value, onToggle, inset }: Props) {
    const s = useAppStyles();
    return (
        <Pressable
            accessibilityRole="switch"
            accessibilityLabel={title}
            accessibilityState={{ checked: value }}
            style={[s.settingRow, !inset && s.sectionCard, !inset && { marginBottom: 12, paddingHorizontal: 16 }]}
            onPress={onToggle}
        >
            {icon && (
                <View style={s.docGlyph}>
                    <Icon name={icon} color="#12715B" />
                </View>
            )}
            <View style={{ flex: 1 }}>
                <Text style={s.productName}>{title}</Text>
                {subtitle && <Text style={s.mutedSmall}>{subtitle}</Text>}
            </View>
            <Switch value={value} />
        </Pressable>
    );
}
