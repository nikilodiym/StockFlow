import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Icon, { type IconName } from '../../../components/ui/Icon';

export type QuickTarget = 'search' | 'scan' | 'docs' | 'files';

const ITEMS: [IconName, string, QuickTarget][] = [
    ['search', 'Пошук', 'search'],
    ['scan', 'Скан', 'scan'],
    ['file', 'Документи', 'docs'],
    ['warehouse', 'Склади', 'files'],
];

/** Four big yellow shortcuts. */
export default function QuickAccess({ compact, onOpen }: { compact: boolean; onOpen: (target: QuickTarget) => void }) {
    const s = useAppStyles();

    return (
        <>
            <Text style={[s.sectionLabel, s.pageTitle]}>Швидкий доступ</Text>
            <View style={s.quickGrid}>
                {ITEMS.map(([icon, label, target]) => (
                    <Pressable
                        key={label}
                        style={[s.quickItem, s.quickItemOffline, compact && s.quickItemCompact]}
                        onPress={() => onOpen(target)}
                    >
                        <View style={[s.quickIconWrap, s.quickIconWrapOffline]}>
                            <Icon name={icon} size={24} color={colors.black} />
                        </View>
                        <Text style={[s.quickLabel, s.quickLabelOffline]}>{label}</Text>
                    </Pressable>
                ))}
            </View>
        </>
    );
}
