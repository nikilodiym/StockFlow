import React from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import Loader from '../../components/ui/Loader';
import { colors } from '../../constants/colors';
import { useAuth } from '../providers/AuthProvider';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { navigationRef } from './navigationRef';

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } };

/** Login flow until the user is authenticated (and unlocked with PIN), then the main app. */
export default function RootNavigator() {
    const { initializing, isAuthenticated } = useAuth();
    if (initializing) return <Loader />;
    return (
        <NavigationContainer ref={navigationRef} theme={theme}>
            {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
        </NavigationContainer>
    );
}
