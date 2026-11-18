import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';
import { QUANTITY_STEPS, stepQuantity } from '../services/BarcodeService';

/** Quantity added per scan with −1 / +1 / +10. */
export default function QuantityPicker({
    value,
    unit,
    onChange,
}: {
    value: string;
    unit: string;
    onChange: (value: string) => void;
}) {
    const s = useAppStyles();

    return (
        <>
            <View style={s.rowBetween}>
                <Text style={s.fieldLabel}>Кількість у документі</Text>
                <Text style={s.quantityValue}>
                    {value} {unit}
                </Text>
            </View>
            <View style={s.quantityChoices}>
                {QUANTITY_STEPS.map((step) => (
                    <Pressable
                        key={step}
                        style={[s.quantityChoice, step === '+1' && s.quantitySelected]}
                        onPress={() => onChange(stepQuantity(value, step))}
                    >
                        <Text style={s.quantityChoiceText}>{step}</Text>
                    </Pressable>
                ))}
            </View>
        </>
    );
}
