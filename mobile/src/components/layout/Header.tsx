import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import s from '../../constants/styles';
import { colors } from '../../constants/colors';
import Icon from '../ui/Icon';

type Props = {
    title: string;
    /** Shows the back arrow (stack screens). */
    back?: boolean;
    /** Custom back action; default is navigation.goBack(). */
    onBack?: () => void;
    right?: React.ReactNode;
};

/** Screen title row: optional back arrow, title, optional actions on the right. */
export default function Header({ title, back, onBack, right }: Props) {
    const navigation = useNavigation();
    if (!back) {
        return (
            <View style={s.pageHeader}>
                <Text style={s.pageTitle}>{title}</Text>
                {right}
            </View>
        );
    }
    return (
        <View style={s.pageHeader}>
            <Pressable accessibilityLabel="Назад" onPress={onBack ?? (() => navigation.goBack())} style={s.backButton}>
                <Icon name="back" size={23} color={colors.text} />
            </Pressable>
            <Text style={s.pageTitle}>{title}</Text>
            <View style={s.headerRight}>{right}</View>
        </View>
    );
}

/** Square icon button used in headers. */
export function HeaderIconButton({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label?: string }) {
    return <Pressable accessibilityLabel={label} style={s.iconButton} onPress={onPress}>{children}</Pressable>;
}
