import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import s from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/ui/Icon';
import Input from '../../../components/ui/Input';
import Header, { HeaderIconButton } from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { useDialog } from '../../../app/providers/DialogProvider';
import type { RootScreenProps } from '../../../app/navigation/types';
import { useInventory } from '../../inventory/hooks/useInventory';
import CameraView from '../components/CameraView';
import QuantityPicker from '../components/QuantityPicker';
import ScanResult from '../components/ScanResult';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

/** Scanning barcodes into the current document (camera or manual code). */
export default function ScannerScreen({ navigation }: RootScreenProps<'Scanner'>) {
    const scanner = useBarcodeScanner();
    const { items, quantity, setQuantity } = useInventory();
    const { showDialog } = useDialog();
    const [manual, setManual] = useState('');
    const lastItem = items[items.length - 1];

    const findManual = async () => {
        if (await scanner.findManual(manual)) setManual('');
    };

    return (
        <ScreenContainer>
            <Header
                back
                title="Сканувати штрих-код"
                right={<HeaderIconButton label="Ліхтарик" onPress={() => showDialog('Сканер', 'Ліхтарик: перемикається на пристрої з камерою.')}><Icon name="zap" size={19} color={colors.text} /></HeaderIconButton>}
            />
            <ScrollView contentContainerStyle={s.pageBody}>
                <CameraView hasPermission={scanner.hasPermission} onRequestPermission={() => void scanner.requestPermission()} paused={scanner.scanned} onBarcode={scanner.onBarcode} />
                <ScanResult scanned={scanner.scanned} lastItem={lastItem} onScanAgain={scanner.resetScan} />
                <QuantityPicker value={quantity} unit={lastItem?.unit || 'шт'} onChange={setQuantity} />
                <Button label={`✓  Готово (${items.length})`} onPress={() => navigation.navigate('DocumentDetail', {})} />
                <Button variant="text" label="▤  Ввести штрихкод вручну" onPress={() => navigation.navigate('Search')} />
                <Input label="РУЧНЕ ВВЕДЕННЯ" placeholder="Штрих-код або SKU" keyboardType="default" value={manual} onChangeText={setManual} />
                <Button variant="scan" label="Знайти й додати товар" onPress={() => void findManual()} />
            </ScrollView>
        </ScreenContainer>
    );
}
