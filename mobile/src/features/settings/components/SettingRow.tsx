import React from 'react';
import { Pressable, Text, View } from 'react-native';
import s from '../../../constants/styles';
import Switch from '../../../components/ui/Switch';

type Props = { title: string; subtitle?: string; value: boolean; onToggle: () => void };

/** Settings row with a toggle; the whole row is pressable. */
export default function SettingRow({ title, subtitle, value, onToggle }: Props) {
    return (
        <Pressable style={s.settingRow} onPress={onToggle}>
            {subtitle ? (
                <View>
                    <Text style={s.productName}>{title}</Text>
                    <Text style={s.mutedSmall}>{subtitle}</Text>
                </View>
            ) : (
                <Text style={s.productName}>{title}</Text>
            )}
            <Switch value={value} />
        </Pressable>
    );
}
