import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** Four PIN dots and the numeric keypad. */
export default function PinPad({
    value,
    onChange,
    enabled,
}: {
    value: string;
    onChange: (value: string) => void;
    enabled: boolean;
}) {
    const s = useAppStyles();

    return (
        <>
            <Text style={s.pinPrompt}>Введіть PIN-код</Text>
            <View style={s.pinDots}>
                {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={[s.pinDot, i < value.length && s.pinDotFilled]} />
                ))}
            </View>
            {enabled ? (
                <View style={s.keypad}>
                    {KEYS.map((digit, i) => (
                        <Pressable
                            key={i}
                            disabled={!digit}
                            style={s.keypadKey}
                            onPress={() =>
                                onChange(digit === '⌫' ? value.slice(0, -1) : value.length < 4 ? value + digit : value)
                            }
                        >
                            <Text style={s.keypadDigit}>{digit}</Text>
                        </Pressable>
                    ))}
                </View>
            ) : (
                <Text style={s.mutedCenter}>
                    PIN-код ще не налаштовано. Увійдіть через email і створіть його в налаштуваннях.
                </Text>
            )}
        </>
    );
}
