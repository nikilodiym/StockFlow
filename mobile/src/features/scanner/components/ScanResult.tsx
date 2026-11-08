import React from 'react';
import { Pressable, Text, View } from 'react-native';
import s from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Icon from '../../../components/ui/Icon';
import type { DocumentItem } from '../../inventory/types/document.types';

/** Result of the last scan with a "scan again" button. */
export default function ScanResult({ scanned, lastItem, onScanAgain }: { scanned: boolean; lastItem?: DocumentItem; onScanAgain: () => void }) {
    return (
        <View style={s.scanStatus}>
            <View style={s.scanResultIcon}><Icon name={scanned ? 'check' : 'scan'} size={18} color={colors.primary} /></View>
            <View style={s.scanResultCopy}>
                <Text style={s.productName}>{scanned ? 'Товар додано в документ' : 'Наведіть камеру або введіть код нижче'}</Text>
                <Text style={s.productCode}>
                    {scanned ? `${lastItem?.name || 'Товар'} · ${lastItem?.barcode || ''}` : 'Після сканування товар з’явиться в документі'}
                </Text>
            </View>
            <Pressable accessibilityLabel="Сканувати ще раз" style={s.scanAgainButton} onPress={onScanAgain}>
                <Icon name="refresh" size={17} color={colors.primary} />
            </Pressable>
        </View>
    );
}
