import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import s from '../../constants/styles';
import { colors } from '../../constants/colors';
import Icon, { type IconName } from '../ui/Icon';

const TABS: Record<string, { icon: IconName; label: string }> = {
    Home: { icon: 'home', label: 'Головна' },
    Documents: { icon: 'file', label: 'Документи' },
    Files: { icon: 'folder', label: 'Файли' },
    Profile: { icon: 'user', label: 'Профіль' },
};

/** Bottom navigation in the WareGo style (replaces the default tab bar). */
export default function TabBar({ state, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    return (
        <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {state.routes.map((route, index) => {
                const tab = TABS[route.name];
                if (!tab) return null;
                const active = state.index === index;
                return (
                    <Pressable
                        key={route.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        style={s.navItem}
                        onPress={() => {
                            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                            if (!active && !event.defaultPrevented) navigation.navigate(route.name);
                        }}
                    >
                        <View style={[s.navIconWrap, active && s.navIconWrapActive]}>
                            <Icon name={tab.icon} size={22} color={active ? colors.primary : colors.muted} />
                        </View>
                        <Text style={[s.navLabel, active && s.navSelected]}>{tab.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
