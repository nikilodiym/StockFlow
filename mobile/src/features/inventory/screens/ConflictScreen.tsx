import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import s from '../../../constants/styles';
import Button from '../../../components/ui/Button';
import Header from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { useDialog } from '../../../app/providers/DialogProvider';
import type { RootScreenProps } from '../../../app/navigation/types';
import { useInventory } from '../hooks/useInventory';
import {usePermissions} from '../../../hooks/usePermissions';

type Choice = 'local' | 'server';

/** Sync conflict: keep the phone's version or take the server's. */
export default function ConflictScreen({ navigation, route }: RootScreenProps<'Conflict'>) {
    const { docId } = route.params;
    const { resolveConflict } = useInventory();
    const { showDialog } = useDialog();
    const [choice, setChoice] = useState<Choice | null>(null);
    const {reportError}=usePermissions();

    const apply = async () => {
        if (!choice) return;
        try {
            await resolveConflict(docId);
            navigation.goBack();
            showDialog('Конфлікт розв’язано', `Застосовано ${choice === 'local' ? 'локальні' : 'серверні'} дані.`, undefined, 'success');
        } catch(error) {reportError(error);}
    };

    return (
        <ScreenContainer>
            <Header back title="Конфлікт синхронізації" />
            <ScrollView contentContainerStyle={s.pageBody}>
                <View style={s.conflictBanner}>
                    <Text style={s.errorText}>⚠ Конфлікт синхронізації</Text>
                    <Text style={s.mutedSmall}>Дані документа змінилися локально та на сервері.</Text>
                </View>
                <Text style={s.sectionLabel}>ОБЕРІТЬ ВЕРСІЮ ДАНИХ</Text>
                {(['local', 'server'] as const).map(option => (
                    <Pressable key={option} style={[s.conflictOption, choice === option && s.conflictChosen]} onPress={() => setChoice(option)}>
                        <View>
                            <Text style={s.productName}>{option === 'local' ? 'Локальні дані' : 'Серверні дані'}</Text>
                            <Text style={s.mutedSmall}>{option === 'local' ? 'Зміни на цьому пристрої' : 'Остання версія з сервера'}</Text>
                        </View>
                        <Text style={s.linkText}>{choice === option ? '◉' : '○'}</Text>
                    </Pressable>
                ))}
                <Button label="Застосувати обрану версію" disabled={!choice} onPress={() => void apply()} />
            </ScrollView>
        </ScreenContainer>
    );
}
