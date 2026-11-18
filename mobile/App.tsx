import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import RootNavigator from './src/app/navigation/RootNavigator';
import AppProviders from './src/app/providers/AppProviders';
import { ScanFeedbackService } from './src/features/scanner/services/ScanFeedbackService';

export default function App() {
    useEffect(() => () => ScanFeedbackService.release(), []);
    const [loaded, error] = useFonts({
        Roboto_400Regular: require('./src/assets/fonts/Roboto_400Regular.ttf'),
        Roboto_500Medium: require('./src/assets/fonts/Roboto_500Medium.ttf'),
        Roboto_600SemiBold: require('./src/assets/fonts/Roboto_600SemiBold.ttf'),
        Roboto_700Bold: require('./src/assets/fonts/Roboto_700Bold.ttf'),
    });
    if (!loaded && !error)
        return (
            <View style={{ flex: 1, backgroundColor: '#F3F3F1', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#12715B" />
            </View>
        );
    return (
        <AppProviders>
            <RootNavigator />
        </AppProviders>
    );
}
