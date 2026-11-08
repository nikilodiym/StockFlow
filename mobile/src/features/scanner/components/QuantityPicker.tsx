import React from 'react';
import { Pressable, Text, View } from 'react-native';
import s from '../../../constants/styles';
import { QUANTITY_STEPS, stepQuantity } from '../services/BarcodeService';

/** Quantity added per scan with −1 / +1 / +10. */
export default function QuantityPicker({ value, unit, onChange }: { value: string; unit: string; onChange: (value: string) => void }) {
    return (
        <>
            <Text style={s.fieldLabel}>КІЛЬКІСТЬ У ДОКУМЕНТІ</Text>
            <Text style={s.quantityValue}>{value} {unit}</Text>
            <View style={s.quantityChoices}>
                {QUANTITY_STEPS.map(step => (
                    <Pressable key={step} style={[s.quantityChoice, step === '+1' && s.quantitySelected]} onPress={() => onChange(stepQuantity(value, step))}>
                        <Text style={s.quantityChoiceText}>{step}</Text>
                    </Pressable>
                ))}
            </View>
        </>
    );
}
