import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import s from '../../../constants/styles';
import { DATE_FILTERS, DOCUMENT_TABS, STATUS_FILTERS } from '../services/DocumentService';
import type { DateFilter, DocumentType, SavedDocument, StatusFilter } from '../types/document.types';

type Props = {
    docType: DocumentType;
    onDocType: (type: DocumentType) => void;
    status: StatusFilter;
    onStatus: (status: StatusFilter) => void;
    date: DateFilter;
    onDate: (date: DateFilter) => void;
    docs: SavedDocument[];
};

/** Document type chips with counters, date and status filters. */
export default function DocumentFilters({ docType, onDocType, status, onStatus, date, onDate, docs }: Props) {
    return (
        <>
            <View style={s.docTypeGrid}>
                {DOCUMENT_TABS.map(([kind, label]) => (
                    <Pressable key={kind} style={[s.docTypeChip, docType === kind && s.docTypeSelected]} onPress={() => onDocType(kind)}>
                        <Text style={[s.docTypeText, docType === kind && s.docTypeTextOn]}>{label}</Text>
                        <Text style={[s.docTypeCount, docType === kind && s.docTypeTextOn]}>{docs.filter(d => d.type === kind).length}</Text>
                    </Pressable>
                ))}
            </View>
            <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
                {DATE_FILTERS.map(label => (
                    <Pressable key={label} onPress={() => onDate(label)} style={[s.filterChip, date === label && s.filterSelected]}>
                        <Text style={[s.filterText, date === label && s.filterTextOn]}>{label}</Text>
                    </Pressable>
                ))}
            </ScrollView>
            <View style={s.statusFilters}>
                {STATUS_FILTERS.map(label => (
                    <Pressable key={label} style={[s.statusFilter, status === label && s.statusFilterOn]} onPress={() => onStatus(label)}>
                        <Text style={[s.statusFilterText, status === label && s.statusFilterTextOn]}>{label}</Text>
                    </Pressable>
                ))}
            </View>
        </>
    );
}
