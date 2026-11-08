import React from 'react';
import { Pressable, Text, View } from 'react-native';
import s from '../../../constants/styles';
import type { AuthMode } from '../types/auth.types';

const MODES: [AuthMode, string][] = [['pin', 'PIN-код'], ['email', 'Email + пароль']];

/** Switch between PIN and email login. */
export default function AuthModeTabs({ mode, onChange }: { mode: AuthMode; onChange: (mode: AuthMode) => void }) {
    return (
        <View style={s.authTabs}>
            {MODES.map(([key, label]) => (
                <Pressable key={key} style={[s.authTab, mode === key && s.authTabActive]} onPress={() => onChange(key)}>
                    <Text style={[s.authTabText, mode === key && s.authTabTextActive]}>{label}</Text>
                </Pressable>
            ))}
        </View>
    );
}
