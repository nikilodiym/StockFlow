import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Icon from '../../../components/ui/Icon';
import { dateLabel } from '../../../utils/formatters';
import { documentIcon, documentLabel, statusLabel, TYPE_LABEL } from '../services/DocumentService';
import type { SavedDocument } from '../types/document.types';

type Props = {
    doc: SavedDocument;
    warehouse: string;
    onPress: (doc: SavedDocument) => void;
    /** Home shows a plain status pill; the list colours it by status. */
    coloredStatus?: boolean;
};

/** Saved document row: icon, short id, type, date, status. */
export default function DocumentCard({ doc, warehouse, onPress, coloredStatus }: Props) {
    const s = useAppStyles();

    return (
        <Pressable style={s.savedDocCard} onPress={() => onPress(doc)}>
            <View style={s.docGlyph}>
                <Icon name={documentIcon(doc.type)} size={24} color={colors.primary} />
            </View>
            <View style={s.productInfo}>
                <Text style={s.productName}>
                    {documentLabel(doc)} {TYPE_LABEL[doc.type]}
                </Text>
                <Text style={s.productCode}>
                    {dateLabel(doc.created_at)} · {warehouse}
                </Text>
            </View>
            <Text
                style={[
                    s.statusPill,
                    doc.status === 'conflict'
                        ? s.statusError
                        : doc.status === 'draft'
                          ? undefined
                          : doc.is_synced
                            ? s.statusDone
                            : s.statusPending,
                ]}
            >
                {doc.is_synced && doc.status !== 'draft' && doc.status !== 'conflict'
                    ? 'Синхронізовано'
                    : statusLabel(doc)}
            </Text>
        </Pressable>
    );
}
