import React from 'react';
import { Pressable, Text, View } from 'react-native';
import s from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Icon from '../../../components/ui/Icon';
import { dateLabel } from '../../../utils/formatters';
import { documentIcon, shortId, statusLabel, TYPE_LABEL } from '../services/DocumentService';
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
    return (
        <Pressable style={s.savedDocCard} onPress={() => onPress(doc)}>
            <View style={s.docGlyph}><Icon name={documentIcon(doc.type)} size={18} color={colors.primary} /></View>
            <View style={s.productInfo}>
                <Text style={s.productName}>{shortId(doc.id)} · {TYPE_LABEL[doc.type]}</Text>
                <Text style={s.productCode}>{dateLabel(doc.created_at)} · {warehouse}</Text>
            </View>
            {coloredStatus
                ? <Text style={[s.statusPill, doc.status === 'posted' ? s.statusDone : s.statusPending]}>{statusLabel(doc)}</Text>
                : <Text style={s.statusPill}>{doc.status === 'draft' ? 'Чернетка' : doc.status}</Text>}
        </Pressable>
    );
}
