import React, { useCallback } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import s from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Icon from '../../../components/ui/Icon';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { useSync } from '../../../app/providers/SyncProvider';
import DocumentCard from '../../inventory/components/DocumentCard';
import { useInventory } from '../../inventory/hooks/useInventory';
import type { SavedDocument } from '../../inventory/types/document.types';
import { useProducts } from '../../products/hooks/useProducts';
import { useWarehousePicker } from '../../settings/hooks/useWarehousePicker';
import CurrentDocumentCard from '../components/CurrentDocumentCard';
import HomeHeader from '../components/HomeHeader';
import OnlineModeCard from '../components/OnlineModeCard';
import QuickAccess, { type QuickTarget } from '../components/QuickAccess';
import ShiftStats from '../components/ShiftStats';
import SyncCard from '../components/SyncCard';

/** Home tab: shortcuts, online mode, sync, current document, latest documents, shift stats. */
export default function HomeScreen() {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const { userName } = useAuth();
    const { warehouse, online, onlineMode, setOnlineMode } = useSettings();
    const { syncing, sync, notificationsRead } = useSync();
    const { products } = useProducts();
    const { docType, setDocType, items, savedDocs, outboxCount, refreshDocs } = useInventory();
    const pickWarehouse = useWarehousePicker();

    useFocusEffect(useCallback(() => { void refreshDocs(); }, [refreshDocs]));

    const open = (target: QuickTarget) => {
        if (target === 'search') navigation.navigate('Search');
        else if (target === 'scan') navigation.navigate('Scanner');
        else if (target === 'docs') navigation.navigate('Tabs', { screen: 'Documents' });
        else navigation.navigate('Tabs', { screen: 'Files' });
    };
    const openDoc = (doc: SavedDocument) => {
        setDocType(doc.type);
        navigation.navigate('DocumentDetail', { docId: doc.id });
    };

    return (
        <ScreenContainer withTabBar>
            <HomeHeader
                warehouse={warehouse}
                userName={userName}
                hasUnread={outboxCount > 0 && !notificationsRead}
                onWarehouse={pickWarehouse}
                onNotifications={() => navigation.navigate('Notifications')}
                onSettings={() => navigation.navigate('Settings')}
            />
            <ScrollView contentContainerStyle={s.homeBody} keyboardShouldPersistTaps="handled">
                <Pressable style={s.searchBar} onPress={() => navigation.navigate('Search')}>
                    <Text style={s.searchPlaceholder}>Назва, SKU або штрихкод</Text>
                    <Icon name="search" size={19} color={colors.mutedIcon} />
                </Pressable>
                <QuickAccess compact={width < 380} onOpen={open} />
                <OnlineModeCard onlineMode={onlineMode} online={online} onToggle={() => setOnlineMode(v => !v)} />
                <SyncCard count={outboxCount} syncing={syncing} onSync={() => void sync()} />
                <CurrentDocumentCard type={docType} items={items} onOpen={() => navigation.navigate('DocumentDetail', {})} onScan={() => navigation.navigate('Scanner')} />
                <View style={s.sectionHeading}>
                    <Text style={s.sectionLabel}>АКТИВНІ ДОКУМЕНТИ</Text>
                    <Pressable onPress={() => open('docs')}><Text style={s.linkText}>Усі</Text></Pressable>
                </View>
                {savedDocs.slice(0, 2).map(doc => <DocumentCard key={doc.id} doc={doc} warehouse={warehouse} onPress={openDoc} />)}
                <Text style={s.sectionLabel}>ВАША ЗМІНА</Text>
                <ShiftStats scans={products.length} documents={savedDocs.length} />
                <Text style={s.shiftTime}>08:00–20:00</Text>
            </ScrollView>
        </ScreenContainer>
    );
}
