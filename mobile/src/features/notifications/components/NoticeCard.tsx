import React from 'react';
import { Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';

type Props = { status: string; statusStyle: object; title: string; children?: React.ReactNode };

/** One notification card: coloured status line, title, details. */
export default function NoticeCard({ status, statusStyle, title, children }: Props) {
    const s = useAppStyles();

    return (
        <View style={s.noticeCard}>
            <Text style={statusStyle}>{status}</Text>
            <Text style={s.productName}>{title}</Text>
            {children}
        </View>
    );
}
