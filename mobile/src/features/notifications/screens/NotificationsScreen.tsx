import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';
import { useResponsiveStyles } from '../../../hooks/useResponsiveStyles';
import Icon from '../../../components/ui/Icon';
import Header from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { useSync } from '../../../app/providers/SyncProvider';
import { useInventory } from '../../inventory/hooks/useInventory';
import { longDateLabel } from '../../../utils/formatters';

export default function NotificationsScreen() {
    const s = useAppStyles();
    const v = useResponsiveStyles(styles);
    const { online } = useSettings();
    const { outboxCount } = useInventory();
    const { sync, notificationsRead, markNotificationsRead } = useSync();
    const [unreadOnly, setUnreadOnly] = useState(false);
    const notices = [
        ...(outboxCount
            ? [
                  {
                      title: 'Є несинхронізовані записи',
                      message: `${outboxCount} записів чекають на відправку на сервер.`,
                      icon: 'database' as const,
                      color: '#2D73BA',
                      background: '#DCEAF9',
                      action: () => void sync(),
                  },
              ]
            : []),
        ...(!online
            ? [
                  {
                      title: 'Немає з’єднання із сервером',
                      message: 'Локальні записи залишаються на пристрої. Спробуємо синхронізувати пізніше.',
                      icon: 'wifi' as const,
                      color: '#D64545',
                      background: '#FCE2E2',
                      action: undefined,
                  },
              ]
            : []),
    ];
    const count = notificationsRead ? 0 : notices.length;
    const visible = unreadOnly && notificationsRead ? [] : notices;
    return (
        <ScreenContainer>
            <Header back title="Сповіщення" />
            <ScrollView contentContainerStyle={s.pageBody}>
                <View style={s.rowBetween}>
                    <Text style={v.count}>{count} непрочитані</Text>
                    <Pressable onPress={markNotificationsRead}>
                        <Text style={s.linkText}>Прочитати всі</Text>
                    </Pressable>
                </View>
                <View style={s.intervalRow}>
                    {[false, true].map((unread) => (
                        <Pressable
                            key={String(unread)}
                            style={[s.intervalOption, unreadOnly === unread && s.intervalSelected]}
                            onPress={() => setUnreadOnly(unread)}
                        >
                            <Text style={unreadOnly === unread ? s.intervalSelectedText : s.intervalText}>
                                {unread ? 'Непрочитані' : 'Усі'}
                            </Text>
                        </Pressable>
                    ))}
                </View>
                <Text style={[s.pageTitle, { marginVertical: 16 }]}>Сьогодні, {longDateLabel()}</Text>
                {visible.map((notice) => (
                    <Pressable key={notice.title} style={v.card} onPress={notice.action} disabled={!notice.action}>
                        <View style={[v.icon, { backgroundColor: notice.background }]}>
                            <Icon name={notice.icon} color={notice.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.productName}>{notice.title}</Text>
                            <Text style={s.productCode}>{notice.message}</Text>
                            {notice.action && (
                                <Text style={[s.productCode, { color: '#12715B' }]}>Синхронізувати зараз</Text>
                            )}
                        </View>
                        {!notificationsRead && <View style={[v.dot, { backgroundColor: notice.color }]} />}
                    </Pressable>
                ))}
                {!visible.length && (
                    <View style={s.emptyState}>
                        <Icon name="bell" size={40} color="#12715B" />
                        <Text style={s.emptyTitle}>Усе прочитано</Text>
                        <Text style={s.mutedCenter}>Нових сповіщень немає</Text>
                    </View>
                )}
            </ScrollView>
        </ScreenContainer>
    );
}
const styles = StyleSheet.create({
    count: {
        fontSize: 12,
        color: '#12715B',
        backgroundColor: '#D7F2E1',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        overflow: 'hidden',
    },
    card: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#EDEDED',
    },
    icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    dot: { width: 12, height: 12, borderRadius: 6 },
});
