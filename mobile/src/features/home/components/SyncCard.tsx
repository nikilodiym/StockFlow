import React from 'react';
import { Text, View } from 'react-native';
import s from '../../../constants/styles';
import Button from '../../../components/ui/Button';
import { recordsLabel, timeLabel } from '../../../utils/formatters';

/** Outbox counter and the manual sync button. */
export default function SyncCard({ count, syncing, onSync }: { count: number; syncing: boolean; onSync: () => void }) {
    return (
        <View style={s.syncCard}>
            <View style={s.rowBetween}>
                <View style={s.rowInline}>
                    <Text style={s.syncCount}>{count}</Text>
                    <View>
                        <Text style={s.cardTitle}>{recordsLabel(count)}</Text>
                        <Text style={s.mutedSmall}>{count ? 'Не синхронізовано' : 'Усе синхронізовано'}</Text>
                    </View>
                </View>
                <Text style={[s.statusPill, count ? s.statusPending : s.statusDone]}>{count ? 'Очікує' : 'Готово'}</Text>
            </View>
            <Text style={s.mutedSmall}>Остання перевірка · {timeLabel()}</Text>
            <Button variant="yellow" label={syncing ? 'Синхронізація…' : 'Синхронізувати записи'} disabled={syncing} onPress={onSync} />
        </View>
    );
}
