import React from 'react';
import { Text, View } from 'react-native';
import s from '../../../constants/styles';

/** Avatar letter, name, role, shift, email. */
export default function ProfileCard({ name, email }: { name: string; email: string }) {
    return (
        <View style={s.profileCard}>
            <View style={s.profileAvatar}><Text style={s.profileAvatarText}>{name.charAt(0).toUpperCase()}</Text></View>
            <View style={s.productInfo}>
                <Text style={s.profileName}>{name}</Text>
                <Text style={s.productCode}>Комірник · WG-0017</Text>
                <Text style={s.statusGreenText}>Зміна відкрита · 08:00–20:00</Text>
                <Text style={s.productCode}>{email || 'worker@warego.ua'}</Text>
            </View>
        </View>
    );
}
