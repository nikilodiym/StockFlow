import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../../constants/colors';

/** Full-screen spinner (e.g. while the saved session is being restored). */
export default function Loader() {
    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
}
