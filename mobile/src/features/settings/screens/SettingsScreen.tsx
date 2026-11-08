import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import s from '../../../constants/styles';
import { SYNC_INTERVALS } from '../../../constants/config';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Header from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useDialog } from '../../../app/providers/DialogProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { timeLabel } from '../../../utils/formatters';
import { isValidPin, sanitizePin } from '../../../utils/validators';
import { useBackup } from '../../files/hooks/useBackup';
import SettingRow from '../components/SettingRow';
import { useServerSettings } from '../hooks/useServerSettings';

/** Server connection, scanner, sync, device data, PIN, sign out. */
export default function SettingsScreen() {
    const settings = useSettings();
    const { storedPin, savePin, signOut } = useAuth();
    const { showDialog } = useDialog();
    const { checkConnection } = useServerSettings();
    const { createBackup } = useBackup();
    const [pin, setPin] = useState('');

    const submitPin = async () => {
        if (!isValidPin(pin)) {
            showDialog('Налаштуйте PIN-код', 'Введіть чотири цифри.', undefined, 'error');
            return;
        }
        await savePin(pin);
        setPin('');
        showDialog('PIN-код збережено', 'Після наступного запуску можна увійти за PIN-кодом.', undefined, 'success');
    };

    return (
        <ScreenContainer>
            <Header back title="Налаштування" />
            <ScrollView contentContainerStyle={s.pageBody}>
                <Text style={s.sectionLabel}>З’ЄДНАННЯ З СЕРВЕРОМ</Text>
                <View style={s.sectionCard}>
                    <Text style={s.settingLabel}>IP-адреса сервера</Text>
                    <Input autoCapitalize="none" value={settings.serverHost} onChangeText={settings.setServerHost} />
                    <Text style={s.settingLabel}>Порт</Text>
                    <Input keyboardType="number-pad" value={settings.serverPort} onChangeText={settings.setServerPort} />
                    <Button variant="yellow" label="Перевірити з’єднання" onPress={() => void checkConnection()} />
                    <View style={settings.online ? s.connectionSuccess : s.connectionOffline}>
                        <Text style={settings.online ? s.statusGreenText : s.offlineTitle}>{settings.online ? '● З’єднання встановлено' : '● Немає з’єднання'}</Text>
                        <Text style={s.mutedSmall}>{settings.online ? 'Сервер доступний' : `Остання перевірка · ${timeLabel()}`}</Text>
                    </View>
                </View>

                <Text style={s.sectionLabel}>СКАНЕР</Text>
                <SettingRow title="◖  Звук сканування" value={settings.soundOn} onToggle={settings.toggleSound} />
                <SettingRow title="▣  Вібрація" value={settings.vibrationOn} onToggle={settings.toggleVibration} />

                <Text style={s.sectionLabel}>СИНХРОНІЗАЦІЯ</Text>
                <View style={s.sectionCard}>
                    <SettingRow title="Автосинхронізація" subtitle="Передавання при появі мережі" value={settings.autoSync} onToggle={() => void settings.toggleAutoSync()} />
                    <Text style={s.settingLabel}>Інтервал синхронізації</Text>
                    <View style={s.intervalRow}>
                        {SYNC_INTERVALS.map(value => (
                            <Pressable key={value} style={[s.intervalOption, settings.syncInterval === value && s.intervalSelected]} onPress={() => void settings.chooseSyncInterval(value)}>
                                <Text style={settings.syncInterval === value ? s.intervalSelectedText : s.intervalText}>{value}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                <Text style={s.sectionLabel}>ДАНІ НА ПРИСТРОЇ</Text>
                <View style={s.sectionCard}>
                    <Pressable style={s.settingRow} onPress={() => void createBackup()}>
                        <Text style={s.productName}>◌  Резервна копія бази</Text>
                        <Text style={s.linkText}>Створити</Text>
                    </Pressable>
                    <Text style={s.mutedSmall}>Експортує локальні товари й документи у форматі JSON.</Text>
                </View>

                <Text style={s.sectionLabel}>БЕЗПЕКА</Text>
                <View style={s.sectionCard}>
                    <Text style={s.settingLabel}>PIN-код для входу</Text>
                    <View style={s.inlineForm}>
                        <TextInput style={[s.input, s.inlineInput]} value={pin} onChangeText={v => setPin(sanitizePin(v))} keyboardType="number-pad" secureTextEntry placeholder="4 цифри" />
                        <Pressable style={s.smallGreenButton} onPress={() => void submitPin()}>
                            <Text style={s.smallGreenText}>{storedPin ? 'Оновити' : 'Зберегти'}</Text>
                        </Pressable>
                    </View>
                    <Text style={s.mutedSmall}>{storedPin ? 'PIN-код налаштований' : 'Створіть PIN для швидкого входу'}</Text>
                </View>

                <Button variant="danger" label="Вийти з облікового запису" onPress={() => void signOut()} />
            </ScrollView>
        </ScreenContainer>
    );
}
