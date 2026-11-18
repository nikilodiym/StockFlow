import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppStyles } from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Button from '../../../components/ui/Button';
import Logo from '../../../components/ui/Logo';
import Input from '../../../components/ui/Input';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { useWarehousePicker } from '../../settings/hooks/useWarehousePicker';
import AuthModeTabs from '../components/AuthModeTabs';
import PinPad from '../components/PinPad';
import { useLogin } from '../hooks/useLogin';

/** Login: warehouse, then PIN or email + password. */
export default function LoginScreen() {
    const s = useAppStyles();

    const { warehouse } = useSettings();
    const pickWarehouse = useWarehousePicker();
    const login = useLogin();

    return (
        <SafeAreaView style={s.root} edges={['top', 'bottom']}>
            <StatusBar style="dark" />
            <ScrollView
                style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}
                contentContainerStyle={s.loginScreen}
                keyboardShouldPersistTaps="handled"
            >
                <View style={s.logoCube}>
                    <Logo />
                </View>
                <Text style={s.loginBrand}>
                    Ware<Text style={s.brandGreen}>Go</Text>
                </Text>
                <Text style={s.loginSubtitle}>Складський облік</Text>

                <Text style={s.fieldLabel}>Склад</Text>
                <Pressable style={s.warehousePicker} onPress={pickWarehouse}>
                    <Text style={s.warehouseText}>{warehouse}</Text>
                    <Text style={s.chevron}>⌄</Text>
                </Pressable>

                <AuthModeTabs mode={login.mode} onChange={login.setMode} />

                {login.mode === 'email' ? (
                    <>
                        <Input
                            label="EMAIL"
                            placeholder="name@warego.ua"
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            value={login.email}
                            onChangeText={login.setEmail}
                        />
                        <Input
                            label="ПАРОЛЬ"
                            secureTextEntry
                            placeholder="Введіть пароль"
                            value={login.password}
                            onChangeText={login.setPassword}
                            onSubmitEditing={() => void login.submitEmail()}
                        />
                        <Button
                            label={login.submitting ? 'Вхід…' : 'Увійти'}
                            disabled={login.submitting}
                            onPress={() => void login.submitEmail()}
                        />
                        <Pressable onPress={login.forgotPassword}>
                            <Text style={s.forgotLink}>Забули пароль?</Text>
                        </Pressable>
                    </>
                ) : (
                    <>
                        <PinPad value={login.pin} onChange={login.setPin} enabled={login.hasPin} />
                        <Button label="Увійти за PIN-кодом" disabled={!login.hasPin} onPress={login.submitPin} />
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
