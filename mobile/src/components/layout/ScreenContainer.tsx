import React from 'react';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import s from '../../constants/styles';

type Props = {
    children: React.ReactNode;
    /** Tab screens leave the bottom edge to the tab bar. */
    withTabBar?: boolean;
};

/** Safe-area screen wrapper with the app background and dark status bar. */
export default function ScreenContainer({ children, withTabBar }: Props) {
    const edges: Edge[] = withTabBar ? ['top'] : ['top', 'bottom'];
    return (
        <SafeAreaView style={s.root} edges={edges}>
            <StatusBar style="dark" />
            <View style={s.appFrame}>{children}</View>
        </SafeAreaView>
    );
}
