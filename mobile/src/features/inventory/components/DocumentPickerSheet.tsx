import { useResponsiveStyles } from '../../../hooks/useResponsiveStyles';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../../components/ui/Icon';
import { documentIcon, documentLabel, TYPE_LABEL } from '../services/DocumentService';
import type { SavedDocument } from '../types/document.types';

type Props = {
    visible: boolean;
    title: string;
    subtitle: string;
    documents: SavedDocument[];
    current?: { title: string; count: number };
    onClose: () => void;
    onSelect: (id: string | null) => void;
    onNew?: () => void;
};
/** Matches the archive's “Куди додавати скани?” bottom sheet. */
export default function DocumentPickerSheet({
    visible,
    title,
    subtitle,
    documents,
    current,
    onClose,
    onSelect,
    onNew,
}: Props) {
    const s = useResponsiveStyles(baseStyles);

    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    return (
        <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
            <View style={s.root}>
                <Pressable accessibilityLabel="Закрити вибір документа" style={s.scrim} onPress={onClose} />
                <View
                    style={[
                        s.sheet,
                        { paddingBottom: Math.max(insets.bottom, 20), maxHeight: height - insets.top - 12 },
                    ]}
                >
                    <View style={s.handle} />
                    <Text style={s.title}>{title}</Text>
                    <Text style={s.subtitle}>{subtitle}</Text>
                    <ScrollView
                        style={{ maxHeight: height * 0.55, flexShrink: 1, flexGrow: 0 }}
                        contentContainerStyle={{ gap: 8 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {current && (
                            <Pressable style={s.row} onPress={() => onSelect(null)}>
                                <View style={s.badge}>
                                    <Icon name="file" size={26} color="#12715B" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.rowTitle}>{current.title}</Text>
                                    <Text style={s.meta}>{current.count} поз.</Text>
                                </View>
                            </Pressable>
                        )}
                        {documents.map((doc) => (
                            <Pressable key={doc.id} style={s.row} onPress={() => onSelect(doc.id)}>
                                <View style={s.badge}>
                                    <Icon name={documentIcon(doc.type)} size={26} color="#12715B" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.rowTitle}>
                                        {documentLabel(doc)} {TYPE_LABEL[doc.type]}
                                    </Text>
                                    <Text style={s.meta}>{doc.line_count ?? 0} поз.</Text>
                                </View>
                            </Pressable>
                        ))}
                        {!current && !documents.length && <Text style={s.empty}>Документів поки немає</Text>}
                    </ScrollView>
                    {onNew && (
                        <Pressable style={s.newButton} onPress={onNew}>
                            <Icon name="plus" size={23} color="#111" />
                            <Text style={s.newText}>Новий документ</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </Modal>
    );
}
const baseStyles = StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(18,26,23,.5)' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingHorizontal: 16,
        paddingTop: 14,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 4,
        backgroundColor: '#D9DCDA',
        alignSelf: 'center',
        marginBottom: 18,
    },
    title: { fontSize: 20, fontWeight: '500', color: '#182021' },
    subtitle: { fontSize: 14, color: '#606876', marginTop: 12, marginBottom: 12 },
    row: {
        minHeight: 68,
        borderWidth: 1,
        borderColor: '#DEE4E1',
        borderRadius: 14,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    badge: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#D7F2E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowTitle: { fontSize: 17, color: '#0E0F10', fontWeight: '500' },
    meta: { fontSize: 12, color: '#606876', marginTop: 5 },
    empty: { fontSize: 14, color: '#606876', paddingVertical: 20, textAlign: 'center' },
    newButton: {
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F5C518',
        marginTop: 12,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    newText: { fontSize: 16, fontWeight: '600', color: '#111' },
});
