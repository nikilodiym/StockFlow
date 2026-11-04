import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import Icon from './Icon';

type DocumentType = 'receipt' | 'writeoff' | 'inventory' | 'transfer';
type Props = { visible: boolean; onClose: () => void; onSelect: (type: DocumentType) => void };

const choices: { type: DocumentType; title: string; description: string; icon: 'download' | 'trash' | 'file' | 'refresh' }[] = [
    { type: 'receipt', title: 'Прихід', description: 'Надходження від постачальника', icon: 'download' },
    { type: 'writeoff', title: 'Списання', description: 'З причиною списання', icon: 'trash' },
    { type: 'inventory', title: 'Інвентаризація', description: 'Порівняння факту з обліком', icon: 'file' },
    { type: 'transfer', title: 'Переміщення', description: 'На інший склад', icon: 'refresh' },
];

export default function NewDocumentSheet({ visible, onClose, onSelect }: Props) {
    if (!visible) return null;
    return (
        <View style={s.root}>
            <Pressable accessibilityLabel="Закрити" style={s.scrim} onPress={onClose} />
            <View style={s.sheet}>
                <View style={s.handle} />
                <View style={s.header}><Text style={s.title}>Новий документ</Text><Pressable style={s.close} onPress={onClose}><Icon name="close" size={20} color="#66706B" /></Pressable></View>
                {choices.map(choice => <Pressable key={choice.type} style={s.choice} onPress={() => onSelect(choice.type)}>
                    <View style={s.icon}><Icon name={choice.icon} size={27} color="#12715B" /></View>
                    <View style={s.copy}><Text style={s.name}>{choice.title}</Text><Text style={s.description}>{choice.description}</Text></View>
                    <Icon name="chevron" size={18} color="#87918B" />
                </Pressable>)}
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, justifyContent: 'flex-end' },
    scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(18,26,23,0.64)' },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, gap: 9, elevation: 16 },
    handle: { width: 38, height: 4, borderRadius: 4, backgroundColor: '#D7DCDA', alignSelf: 'center', marginBottom: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
    title: { fontSize: 22, fontWeight: '700', color: '#182021' },
    close: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F5F4', alignItems: 'center', justifyContent: 'center' },
    choice: { minHeight: 88, borderRadius: 15, borderWidth: 1, borderColor: '#E6E9E7', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff' },
    icon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#D7F2E1', alignItems: 'center', justifyContent: 'center' },
    copy: { flex: 1, gap: 4 },
    name: { fontSize: 18, fontWeight: '600', color: '#182021' },
    description: { fontSize: 13, color: '#606876' },
});
