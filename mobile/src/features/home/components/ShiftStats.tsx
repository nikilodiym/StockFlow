import React from 'react';
import { Text, View } from 'react-native';
import s from '../../../constants/styles';

/** Three counters of the shift (also used on the Profile screen). */
export default function ShiftStats({ scans, documents, discrepancies = 0 }: { scans: number; documents: number; discrepancies?: number }) {
    return (
        <View style={s.statsRow}>
            <View style={s.statCard}><Text style={s.statNumber}>{scans}</Text><Text style={s.mutedSmall}>Сканів</Text></View>
            <View style={s.statCard}><Text style={s.statNumber}>{documents}</Text><Text style={s.mutedSmall}>Документів</Text></View>
            <View style={s.statCard}><Text style={s.statNumber}>{discrepancies}</Text><Text style={s.mutedSmall}>Розбіжностей</Text></View>
        </View>
    );
}
