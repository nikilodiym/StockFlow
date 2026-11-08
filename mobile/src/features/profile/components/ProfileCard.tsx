import React from 'react';
import { Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { roleOn } from '../../auth/services/PermissionService';
import { warehouseId } from '../../inventory/services/DocumentService';
export default function ProfileCard({ name, email }: { name: string; email: string }) {
    const s = useAppStyles();
    const { user } = useAuth();
    const { warehouse } = useSettings();
    const role = roleOn(user, warehouseId(warehouse));
    const roleName =
        role === 'admin'
            ? 'Адміністратор'
            : role === 'manager'
              ? 'Менеджер'
              : role === 'worker'
                ? 'Комірник'
                : 'Без доступу';
    return (
        <View style={s.profileCard}>
            <View style={[s.rowInline, { gap: 16 }]}>
                <View style={s.profileAvatar}>
                    <Text style={s.profileAvatarText}>
                        {name
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join('')
                            .toUpperCase()}
                    </Text>
                </View>
                <View style={s.productInfo}>
                    <Text style={s.profileName}>{name}</Text>
                    <Text style={s.productCode}>
                        {roleName}
                        {user?.id ? ` · WG-${String(user.id).padStart(4, '0')}` : ''}
                    </Text>
                </View>
            </View>
            <View
                style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#D7F2E1',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                }}
            >
                <Text style={s.statusGreenText}>Обліковий запис активний</Text>
            </View>
            {!!email && <Text style={s.productCode}>{email}</Text>}
        </View>
    );
}
