import React from 'react';
import { Text, View } from 'react-native';
import s from '../../../constants/styles';

const BARS = [28, 42, 34, 62, 48, 76, 54];

/** Scans per hour (demo values until real statistics come from the server). */
export default function ScanChart() {
    return (
        <View style={s.chartCard}>
            <Text style={s.productName}>Сканувань за годинами</Text>
            <View style={s.chartBars}>
                {BARS.map((height, i) => (
                    <View key={i} style={s.chartColumn}>
                        <View style={[s.chartBar, { height }, i === 5 && s.chartBarActive]} />
                        <Text style={s.chartLabel}>{8 + i}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}
