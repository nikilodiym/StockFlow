import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppStyles } from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/ui/Icon';
import Header, { HeaderIconButton } from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { longDateLabel } from '../../../utils/formatters';
import ShiftStats from '../../home/components/ShiftStats';
import { useInventory } from '../../inventory/hooks/useInventory';
import { useProducts } from '../../products/hooks/useProducts';
import { useWarehousePicker } from '../../settings/hooks/useWarehousePicker';
import ProfileCard from '../components/ProfileCard';
import RoleList from '../components/RoleList';
import ScanChart from '../components/ScanChart';

/** Profile tab: user, main warehouse, shift statistics, access levels, sign out. */
export default function ProfileScreen() {
    const s = useAppStyles();

    const navigation = useNavigation();
    const { userName, userEmail, signOut } = useAuth();
    const { warehouse } = useSettings();
    const { products } = useProducts();
    const { savedDocs } = useInventory();
    const pickWarehouse = useWarehousePicker();

    return (
        <ScreenContainer withTabBar>
            <Header
                title="Мій профіль"
                right={
                    <HeaderIconButton label="Налаштування" onPress={() => navigation.navigate('Settings')}>
                        <Icon name="settings" size={20} color={colors.text} />
                    </HeaderIconButton>
                }
            />
            <ScrollView contentContainerStyle={s.pageBody}>
                <ProfileCard name={userName} email={userEmail} />
                <Pressable style={s.warehouseCard} onPress={pickWarehouse}>
                    <View style={s.warehouseIcon}>
                        <Icon name="warehouse" size={24} color={colors.primary} />
                    </View>
                    <View style={s.productInfo}>
                        <Text style={s.productCode}>ОСНОВНИЙ СКЛАД</Text>
                        <Text style={s.profileName}>{warehouse}</Text>
                        <Text style={s.productCode}>Основний склад для документів</Text>
                    </View>
                    <Text style={s.chevron}>›</Text>
                </Pressable>
                <View style={s.sectionHeading}>
                    <Text style={s.sectionLabel}>Статистика зміни</Text>
                    <Text style={s.linkText}>{longDateLabel()}</Text>
                </View>
                <ShiftStats scans={products.length} documents={savedDocs.length} />
                <ScanChart />
                <RoleList />
                <Button
                    variant="danger"
                    icon="logout"
                    label="Вийти з облікового запису"
                    onPress={() => void signOut()}
                />
            </ScrollView>
        </ScreenContainer>
    );
}
