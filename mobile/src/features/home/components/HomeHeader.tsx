import React from 'react';
import { Pressable, Text, View } from 'react-native';
import s from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Icon from '../../../components/ui/Icon';

type Props = {
    warehouse: string;
    userName: string;
    hasUnread: boolean;
    onWarehouse: () => void;
    onNotifications: () => void;
    onSettings: () => void;
    onPrint: () => void;
};

/** Title, warehouse switcher, user, bell and settings buttons. */
export default function HomeHeader({
    warehouse,
    userName,
    hasUnread,
    onWarehouse,
    onNotifications,
    onSettings,
    onPrint,
}: Props) {
    return (
        <View style={s.homeHeader}>
            <View>
                <Text style={s.pageTitle}>Головна</Text>
                <Pressable style={s.warehouseInline} onPress={onWarehouse}>
                    <Text style={s.warehouseInlineText}>⌂ {warehouse} ⌄</Text>
                </Pressable>
                <Text style={s.mutedSmall}>{userName} · Складський облік</Text>
            </View>
            <View style={s.headerActions}>
                <Pressable accessibilityLabel="Друк документів" style={s.iconButton} onPress={onPrint}>
                    <Icon name="printer" size={20} color={colors.text} />
                </Pressable>
                <Pressable accessibilityLabel="Сповіщення" style={s.iconButton} onPress={onNotifications}>
                    <Icon name="bell" size={20} color={colors.text} />
                    {hasUnread && <View style={s.unreadDot} />}
                </Pressable>
                <Pressable accessibilityLabel="Налаштування" style={s.iconButton} onPress={onSettings}>
                    <Icon name="settings" size={20} color={colors.text} />
                </Pressable>
            </View>
        </View>
    );
}
