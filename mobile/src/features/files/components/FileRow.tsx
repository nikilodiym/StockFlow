import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Icon, { type IconName } from '../../../components/ui/Icon';

type Props = { title: string; meta?: string; icon?: IconName; onPress: () => void };

/** A file or a file action in the Files list. */
export default function FileRow({ title, meta, icon = 'file', onPress }: Props) {
    const s = useAppStyles();

    return (
        <Pressable style={s.fileAction} onPress={onPress}>
            <View style={s.fileIcon}>
                <Icon name={icon} size={24} color={colors.primary} />
            </View>
            {meta ? (
                <View style={s.productInfo}>
                    <Text style={s.productName}>{title}</Text>
                    <Text style={s.productCode}>{meta}</Text>
                </View>
            ) : (
                <Text style={s.productName}>{title}</Text>
            )}
        </Pressable>
    );
}
