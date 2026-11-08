import React from 'react';
import { Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';
import Button from '../../../components/ui/Button';
import { recordsLabel } from '../../../utils/formatters';
export default function SyncCard({ count, syncing, onSync }: { count: number; syncing: boolean; onSync: () => void }) {
    const s = useAppStyles();
    return (
        <View style={s.syncCard}>
            <View style={[s.rowInline, { gap: 12, flexWrap: 'wrap' }]}>
                <Text style={s.syncCount}>
                    {count} {recordsLabel(count)}
                </Text>
                <View style={{ flex: 1, minWidth: 130 }}>
                    <Text style={s.cardTitle}>{count ? 'Не синхронізовано' : 'Усе синхронізовано'}</Text>
                    <Text style={s.mutedSmall}>
                        {syncing ? 'Триває передавання даних…' : 'Локальні дані на пристрої'}
                    </Text>
                </View>
            </View>
            <Text style={[s.mutedSmall, { marginTop: 12 }]}>
                {count ? `Очікують синхронізації: ${count}` : 'Черга синхронізації порожня'}
            </Text>
            <Button
                variant="yellow"
                label={syncing ? 'Синхронізація…' : 'Синхронізувати записи'}
                disabled={syncing}
                onPress={onSync}
            />
        </View>
    );
}
