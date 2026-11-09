import React from 'react';
import { Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { roleOn } from '../../auth/services/PermissionService';
import { warehouseId } from '../../inventory/services/DocumentService';

const ROLES: [string, string][] = [
    ['Комірник', 'Сканування, документи та облік товару'],
    ['Менеджер', 'Контроль складу й звітність'],
    ['Адміністратор', 'Усі права комірника й менеджера на всіх складах, налаштування та керування доступом'],
];

/** Access levels; the badge follows the user's actual warehouse membership. */
export default function RoleList() {
    const s = useAppStyles();

    const { user } = useAuth();
    const { warehouse } = useSettings();
    const role = roleOn(user, warehouseId(warehouse));
    const selected = role === 'admin' ? 2 : role === 'manager' ? 1 : role === 'worker' ? 0 : -1;
    return (
        <>
            <Text style={s.sectionLabel}>Ролі та доступ</Text>
            {ROLES.map(([role, description], i) => (
                <View key={role} style={s.roleCard}>
                    <View style={s.rowBetween}>
                        <Text style={s.productName}>{role}</Text>
                        <Text style={[s.statusPill, i === selected ? s.statusDone : undefined]}>
                            {i === selected ? 'Ваш рівень' : 'Інший рівень'}
                        </Text>
                    </View>
                    <Text style={s.mutedSmall}>{description}</Text>
                </View>
            ))}
        </>
    );
}
