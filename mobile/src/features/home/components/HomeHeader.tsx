import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';
import Icon from '../../../components/ui/Icon';
type Props = {
    warehouse: string;
    userName: string;
    role: string;
    hasUnread: boolean;
    onWarehouse: () => void;
    onNotifications: () => void;
    onSettings: () => void;
    onPrint: () => void;
};
export default function HomeHeader({
    warehouse,
    userName,
    role,
    hasUnread,
    onWarehouse,
    onNotifications,
    onSettings,
    onPrint,
}: Props) {
    const s = useAppStyles();
    return (
        <View style={s.homeHeader}>
            <View style={[s.rowBetween, { width: '100%' }]}>
                <Text style={s.pageTitle}>Головна</Text>
                <View style={s.headerActions}>
                    <Pressable accessibilityLabel="Друк документів" style={s.iconButton} onPress={onPrint}>
                        <Icon name="printer" />
                    </Pressable>
                    <Pressable accessibilityLabel="Сповіщення" style={s.iconButton} onPress={onNotifications}>
                        <Icon name="bell" />
                        {hasUnread && <View style={s.unreadDot} />}
                    </Pressable>
                    <Pressable accessibilityLabel="Налаштування" style={s.iconButton} onPress={onSettings}>
                        <Icon name="settings" />
                    </Pressable>
                </View>
            </View>
            <View>
                <Pressable style={s.warehouseInline} onPress={onWarehouse}>
                    <Icon name="warehouse" />
                    <Text style={[s.warehouseInlineText, { flexShrink: 1 }]}>{warehouse}</Text>
                    <Icon name="chevronDown" size={18} />
                </Pressable>
                <Text style={s.mutedSmall}>
                    {userName} · {role}
                </Text>
            </View>
        </View>
    );
}
