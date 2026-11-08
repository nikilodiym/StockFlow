import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import s from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Icon from '../../../components/ui/Icon';
import Header from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { useSync } from '../../../app/providers/SyncProvider';
import { useInventory } from '../../inventory/hooks/useInventory';
import NoticeCard from '../components/NoticeCard';

/** Connection status and documents waiting for sync. */
export default function NotificationsScreen() {
    const { online } = useSettings();
    const { outboxCount } = useInventory();
    const { sync, notificationsRead, markNotificationsRead } = useSync();
    const hasPending = outboxCount > 0 && !notificationsRead;

    return (
        <ScreenContainer>
            <Header back title="Сповіщення" right={<Pressable onPress={markNotificationsRead}><Text style={s.linkText}>Прочитати все</Text></Pressable>} />
            <ScrollView contentContainerStyle={s.pageBody}>
                <NoticeCard status={online ? '● Мережа з’єднана' : '● Офлайн-режим'} statusStyle={s.statusGreenText} title="Статус з’єднання">
                    <Text style={s.mutedSmall}>Застосунок перевіряє сервер автоматично.</Text>
                </NoticeCard>
                {hasPending && (
                    <NoticeCard status="● Очікує синхронізації" statusStyle={s.statusPending} title={`${outboxCount} локальних записів`}>
                        <Pressable onPress={() => void sync()}><Text style={s.linkText}>Синхронізувати зараз</Text></Pressable>
                    </NoticeCard>
                )}
                {!hasPending && (
                    <View style={s.emptyState}>
                        <Icon name="bell" size={28} color={colors.primary} />
                        <Text style={s.emptyTitle}>Усе прочитано</Text>
                        <Text style={s.mutedCenter}>Нових сповіщень немає</Text>
                    </View>
                )}
            </ScrollView>
        </ScreenContainer>
    );
}
