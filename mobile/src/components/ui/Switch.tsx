import React from 'react';
import { Pressable, View } from 'react-native';
import { useAppStyles } from '../../constants/styles';

type Props = { value: boolean; onToggle?: () => void; offlineStyle?: boolean };

/** WareGo toggle. Without onToggle it is display-only (the whole row is pressable). */
export default function Switch({ value, onToggle, offlineStyle }: Props) {
    const s = useAppStyles();

    const track = [s.switch, value ? s.switchOn : offlineStyle ? s.switchOffline : null];
    const knob = <View style={[s.switchKnob, value && s.switchKnobOn]} />;
    if (!onToggle) return <View style={track}>{knob}</View>;
    return (
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} style={track} onPress={onToggle}>
            {knob}
        </Pressable>
    );
}
