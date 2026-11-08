import { useResponsiveStyles } from '../../../hooks/useResponsiveStyles';
import React from 'react';
import { Modal, Pressable, Text, View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../../components/ui/Icon';
import type { DocumentType } from '../types/document.types';
type Props = { visible: boolean; onClose: () => void; onSelect: (type: DocumentType) => void };

const choices: {
    type: DocumentType;
    title: string;
    description: string;
    icon: 'download' | 'trash' | 'file' | 'refresh';
}[] = [
    { type: 'receipt', title: 'Прихід', description: 'Надходження від постачальника', icon: 'download' },
    { type: 'writeoff', title: 'Списання', description: 'З причиною списання', icon: 'trash' },
    { type: 'inventory', title: 'Інвентаризація', description: 'Порівняння факту з обліком', icon: 'file' },
    { type: 'transfer', title: 'Переміщення', description: 'На інший склад', icon: 'refresh' },
];

/** Bottom sheet: which document to create. Rendered in a native Modal so it covers the tab bar. */
export default function NewDocumentSheet({ visible, onClose, onSelect }: Props) {
    const s = useResponsiveStyles(baseStyles);
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <View style={s.root}>
                <Pressable accessibilityLabel="Закрити" style={s.scrim} onPress={onClose} />
                <View
                    style={[
                        s.sheet,
                        { maxHeight: height - insets.top - 12, paddingBottom: Math.max(insets.bottom, 20) },
                    ]}
                >
                    <View style={s.handle} />
                    <View style={s.header}>
                        <Text style={s.title}>Новий документ</Text>
                        <Pressable style={s.close} onPress={onClose}>
                            <Icon name="close" size={20} color="#66706B" />
                        </Pressable>
                    </View>
                    <ScrollView style={{ flexShrink: 1, flexGrow: 0 }} contentContainerStyle={{ gap: 9 }}>
                        {choices.map((choice) => (
                            <Pressable key={choice.type} style={s.choice} onPress={() => onSelect(choice.type)}>
                                <View style={s.icon}>
                                    <Icon name={choice.icon} size={27} color="#12715B" />
                                </View>
                                <View style={s.copy}>
                                    <Text style={s.name}>{choice.title}</Text>
                                    <Text style={s.description}>{choice.description}</Text>
                                </View>
                                <Icon name="chevron" size={18} color="#606876" />
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const baseStyles = StyleSheet.create({
    root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, justifyContent: 'flex-end' },
    scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(18,26,23,0.64)' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 26,
        gap: 9,
        elevation: 16,
    },
    handle: { width: 38, height: 4, borderRadius: 4, backgroundColor: '#D7DCDA', alignSelf: 'center', marginBottom: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
    title: { fontSize: 20, fontWeight: '500', color: '#182021' },
    close: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#F3F5F4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    choice: {
        minHeight: 68,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#DEE4E1',
        paddingHorizontal: 15,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: '#fff',
    },
    icon: {
        width: 44,
        height: 44,
        borderRadius: 16,
        backgroundColor: '#D7F2E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    copy: { flex: 1, gap: 4 },
    name: { fontSize: 16, fontWeight: '500', color: '#182021' },
    description: { fontSize: 12, color: '#606876' },
});
