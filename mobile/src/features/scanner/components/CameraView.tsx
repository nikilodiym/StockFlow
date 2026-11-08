import React from 'react';
import { Text, View } from 'react-native';
import { CameraView as ExpoCameraView } from 'expo-camera';
import s from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/ui/Icon';
import { BARCODE_TYPES } from '../services/BarcodeService';

type Props = {
    hasPermission: boolean;
    onRequestPermission: () => void;
    /** Paused while a scan is being handled. */
    paused: boolean;
    onBarcode: (data: string) => void;
};

/** Camera with the scan frame, or a permission request card. */
export default function CameraView({ hasPermission, onRequestPermission, paused, onBarcode }: Props) {
    if (!hasPermission) {
        return (
            <View style={s.cameraRequest}>
                <Icon name="scan" size={28} color={colors.primary} />
                <Text style={s.emptyTitle}>Сканування штрих-коду</Text>
                <Text style={s.mutedCenter}>Дозвольте доступ до камери</Text>
                <Button label="Увімкнути камеру" onPress={onRequestPermission} />
            </View>
        );
    }
    return (
        <View style={s.cameraWrap}>
            <ExpoCameraView
                style={s.camera}
                facing="back"
                onBarcodeScanned={paused ? undefined : ({ data }) => onBarcode(data)}
                barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            />
            <View pointerEvents="none" style={s.cameraOverlay}>
                <View style={s.scanFrame} />
                <Text style={s.scanCaption}>Наведіть камеру на штрихкод</Text>
            </View>
        </View>
    );
}
