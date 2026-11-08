import React from 'react';
import { Text, View } from 'react-native';
import s from '../../../constants/styles';

const ROLES: [string, string][] = [
    ['Комірник', 'Сканування, документи та облік товару'],
    ['Менеджер', 'Контроль складу й звітність'],
    ['Адміністратор', 'Налаштування та керування доступом'],
];

/** Access levels; the first one is the current user's. */
export default function RoleList() {
    return (
        <>
            <Text style={s.sectionLabel}>РІВНІ ДОСТУПУ</Text>
            {ROLES.map(([role, description], i) => (
                <View key={role} style={s.roleCard}>
                    <View>
                        <Text style={s.productName}>{role}</Text>
                        <Text style={s.mutedSmall}>{description}</Text>
                    </View>
                    <Text style={[s.statusPill, i === 0 ? s.statusDone : s.statusPending]}>{i === 0 ? 'Ваш рівень' : 'Перегляд'}</Text>
                </View>
            ))}
        </>
    );
}
