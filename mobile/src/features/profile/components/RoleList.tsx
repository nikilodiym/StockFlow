import React from 'react';
import { Text, View } from 'react-native';
import s from '../../../constants/styles';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { roleOn } from '../../auth/services/PermissionService';
import { warehouseId } from '../../inventory/services/DocumentService';

const ROLES: [string, string][] = [
    ['Комірник', 'Сканування, документи та облік товару'],
    ['Менеджер', 'Контроль складу й звітність'],
    ['Адміністратор', 'Налаштування та керування доступом'],
];

/** Access levels; the first one is the current user's. */
export default function RoleList() {
    const { user } = useAuth();
    const { warehouse } = useSettings();
    const role = roleOn(user, warehouseId(warehouse));
    const selected = role === 'admin' ? 2 : role === 'manager' ? 1 : role === 'worker' ? 0 : -1;
    return (
        <>
            <Text style={s.sectionLabel}>РІВНІ ДОСТУПУ</Text>
            {ROLES.map(([role, description], i) => (
                <View key={role} style={s.roleCard}>
                    <View>
                        <Text style={s.productName}>{role}</Text>
                        <Text style={s.mutedSmall}>{description}</Text>
                    </View>
                    <Text style={[s.statusPill, i === selected ? s.statusDone : s.statusPending]}>
                        {i === selected ? 'Ваш рівень' : 'Перегляд'}
                    </Text>
                </View>
            ))}
        </>
    );
}
