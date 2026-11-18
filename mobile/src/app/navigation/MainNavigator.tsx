import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabBar from '../../components/layout/TabBar';
import FilesScreen from '../../features/files/screens/FilesScreen';
import ImportScreen from '../../features/files/screens/ImportScreen';
import HomeScreen from '../../features/home/screens/HomeScreen';
import ConflictScreen from '../../features/inventory/screens/ConflictScreen';
import DocumentDetailScreen from '../../features/inventory/screens/DocumentDetailScreen';
import DocumentsScreen from '../../features/inventory/screens/DocumentsScreen';
import NotificationsScreen from '../../features/notifications/screens/NotificationsScreen';
import SearchScreen from '../../features/products/screens/SearchScreen';
import CreateProductScreen from '../../features/products/screens/CreateProductScreen';
import ProfileScreen from '../../features/profile/screens/ProfileScreen';
import ScannerScreen from '../../features/scanner/screens/ScannerScreen';
import SettingsScreen from '../../features/settings/screens/SettingsScreen';
import type { RootStackParamList, TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

/** Bottom tabs: Home, Documents, Files, Profile. */
function Tabs() {
    return (
        <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Documents" component={DocumentsScreen} />
            <Tab.Screen name="Files" component={FilesScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
}

/** Screens after login: tabs plus full-screen pages opened on top of them. */
export default function MainNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="Scanner" component={ScannerScreen} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="CreateProduct" component={CreateProductScreen} />
            <Stack.Screen name="DocumentDetail" component={DocumentDetailScreen} />
            <Stack.Screen name="Conflict" component={ConflictScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Import" component={ImportScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </Stack.Navigator>
    );
}
