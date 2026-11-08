import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppStyles } from '../../../constants/styles';
import { useResponsiveStyles } from '../../../hooks/useResponsiveStyles';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/ui/Icon';
import Input from '../../../components/ui/Input';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { usePermissions } from '../../../hooks/usePermissions';
import type { RootScreenProps } from '../../../app/navigation/types';
import { useInventory } from '../../inventory/hooks/useInventory';
import { documentLabel, TYPE_LABEL } from '../../inventory/services/DocumentService';
import CameraView from '../components/CameraView';
import QuantityPicker from '../components/QuantityPicker';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

export default function ScannerScreen({ navigation }: RootScreenProps<'Scanner'>) {
    const s = useAppStyles();
    const v = useResponsiveStyles(styles);
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const scanner = useBarcodeScanner();
    const { soundOn, vibrationOn, onlineMode } = useSettings();
    const {
        scanItems: items,
        scanDocumentId,
        savedDocs,
        docType,
        quantity,
        setQuantity,
        changeItemQuantity,
        changeSavedItemQuantity,
    } = useInventory();
    const { reportError } = usePermissions();
    const [torch, setTorch] = useState(false);
    const [manualOpen, setManualOpen] = useState(false);
    const [manual, setManual] = useState('');
    const lastItem = scanner.found ? items.find((p) => p.barcode === scanner.lastCode) : undefined;
    const doc = savedDocs.find((d) => d.id === scanDocumentId);
    const findManual = async () => {
        if (await scanner.findManual(manual)) {
            setManual('');
            setManualOpen(false);
        }
    };
    const changeQuantity = async (next: string) => {
        if (!lastItem) {
            setQuantity(next);
            return;
        }
        const delta = Number(next) - lastItem.quantity;
        try {
            if (scanDocumentId) await changeSavedItemQuantity(scanDocumentId, items, lastItem, delta);
            else await changeItemQuantity(lastItem, delta);
        } catch (error) {
            reportError(error, 'Не вдалося змінити кількість');
        }
    };
    return (
        <View style={v.root}>
            <StatusBar style="light" />
            <View style={[v.cameraRegion, { height: Math.max(280, height * 0.53) }]}>
                <CameraView
                    fill
                    torch={torch}
                    hasPermission={scanner.hasPermission}
                    onRequestPermission={() => void scanner.requestPermission()}
                    paused={scanner.scanned}
                    onBarcode={scanner.onBarcode}
                />
                <View style={[v.topBar, { top: insets.top + 12 }]}>
                    <Pressable accessibilityLabel="Назад" hitSlop={12} onPress={() => navigation.goBack()}>
                        <Icon name="back" color="#fff" />
                    </Pressable>
                    <Text numberOfLines={2} style={v.document}>
                        {doc ? documentLabel(doc) : TYPE_LABEL[docType]}
                    </Text>
                    <Pressable
                        accessibilityLabel="Ліхтарик"
                        accessibilityRole="switch"
                        accessibilityState={{ checked: torch }}
                        hitSlop={12}
                        onPress={() => setTorch((x) => !x)}
                    >
                        <Icon name="zap" color={torch ? '#F5C518' : '#fff'} />
                    </Pressable>
                </View>
                {scanner.hasPermission && (
                    <View pointerEvents="none" style={v.frameArea}>
                        <View style={v.frame} />
                        <Text style={v.cameraCaption}>Наведіть камеру на штрихкод</Text>
                    </View>
                )}
                <View pointerEvents="none" style={v.feedbackRow}>
                    <Icon name="speaker" size={18} color="#fff" />
                    <Text style={v.feedback}>{soundOn ? 'Звук увімкнено' : 'Звук вимкнено'}</Text>
                    <Icon name="vibration" size={18} color="#fff" />
                    <Text style={v.feedback}>{vibrationOn ? 'Вібрація увімкнена' : 'Вібрація вимкнена'}</Text>
                </View>
            </View>
            <ScrollView
                style={v.panel}
                contentContainerStyle={[v.panelBody, { paddingBottom: insets.bottom + 16 }]}
                keyboardShouldPersistTaps="handled"
            >
                <View style={s.rowBetween}>
                    <Text style={[v.badge, !onlineMode && v.offlineBadge]}>
                        {scanner.found
                            ? 'Штрихкод розпізнано'
                            : scanner.scanned
                              ? 'Штрихкод не знайдено'
                              : 'Очікування сканування'}
                    </Text>
                    <Text style={s.mutedSmall}>{scanner.found ? 'Щойно' : !onlineMode ? 'Офлайн' : ''}</Text>
                </View>
                <View style={v.productRow}>
                    <View style={s.productBadge}>
                        {lastItem ? <Text style={s.badgeText}>SKU</Text> : <Icon name="scan" color="#12715B" />}
                    </View>
                    <View style={s.productInfo}>
                        <Text style={s.productName}>
                            {lastItem?.name ?? (scanner.scanned ? 'Товар відсутній у каталозі' : 'Відскануйте товар')}
                        </Text>
                        <Text style={s.productCode}>
                            {lastItem
                                ? `${lastItem.sku} · ${lastItem.barcode}`
                                : 'Товар з’явиться тут після сканування'}
                        </Text>
                    </View>
                </View>
                <QuantityPicker
                    value={lastItem ? String(lastItem.quantity) : quantity}
                    unit={lastItem?.unit || 'шт'}
                    onChange={(next) => void changeQuantity(next)}
                />
                <Button
                    icon="check"
                    label={`Готово (${items.length})`}
                    onPress={() => navigation.navigate('DocumentDetail', { docId: scanDocumentId ?? undefined })}
                />
                {scanner.scanned && (
                    <Button
                        variant="secondary"
                        icon="scan"
                        label="Сканувати наступний товар"
                        onPress={scanner.resetScan}
                    />
                )}
                <Button
                    variant="text"
                    icon="keyboard"
                    label="Ввести штрихкод вручну"
                    onPress={() => setManualOpen((x) => !x)}
                />
                {manualOpen && (
                    <>
                        <Input
                            label="Штрихкод"
                            placeholder="Штрих-код або SKU"
                            value={manual}
                            onChangeText={setManual}
                            autoCapitalize="none"
                            onSubmitEditing={() => void findManual()}
                        />
                        <Button variant="scan" label="Знайти й додати товар" onPress={() => void findManual()} />
                    </>
                )}
            </ScrollView>
        </View>
    );
}
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#17231D' },
    cameraRegion: { width: '100%' },
    topBar: {
        position: 'absolute',
        left: 24,
        right: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
    },
    document: { fontSize: 16, fontWeight: '500', color: '#fff', flex: 1, textAlign: 'center' },
    frameArea: { position: 'absolute', left: 30, right: 30, top: '29%', alignItems: 'center' },
    frame: {
        height: 180,
        width: '100%',
        maxWidth: 500,
        borderWidth: 3,
        borderColor: '#12715B',
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.04)',
    },
    cameraCaption: { fontSize: 14, color: '#fff', marginTop: 20, textAlign: 'center' },
    feedbackRow: {
        position: 'absolute',
        bottom: 38,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    feedback: { fontSize: 12, color: '#fff', marginRight: 6 },
    panel: { flex: 1, marginTop: -22, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#fff' },
    panelBody: { padding: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
    badge: {
        fontSize: 12,
        fontWeight: '500',
        color: '#12715B',
        backgroundColor: '#D7F2E1',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        overflow: 'hidden',
    },
    offlineBadge: { backgroundColor: '#FFF3CC' },
    productRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
});
