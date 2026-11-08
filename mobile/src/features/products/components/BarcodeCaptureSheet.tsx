import React, { useRef } from 'react';
import { Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import CameraView from '../../scanner/components/CameraView';
import Icon from '../../../components/ui/Icon';

export default function BarcodeCaptureSheet({
    visible,
    onClose,
    onCapture,
}: {
    visible: boolean;
    onClose: () => void;
    onCapture: (barcode: string) => void;
}) {
    const [permission, requestPermission] = useCameraPermissions();
    const busy = useRef(false);
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
            onShow={() => {
                busy.current = false;
            }}
        >
            <View style={s.root}>
                <Pressable style={s.scrim} onPress={onClose} />
                <View style={s.sheet}>
                    <View style={s.handle} />
                    <View style={s.heading}>
                        <Text style={s.title}>Штрихкод нового товару</Text>
                        <Pressable accessibilityLabel="Закрити сканер" onPress={onClose}>
                            <Icon name="close" />
                        </Pressable>
                    </View>
                    <Text style={s.help}>Відскануйте код з упаковки. Потім заповніть назву та SKU товару.</Text>
                    <CameraView
                        hasPermission={!!permission?.granted}
                        onRequestPermission={() => void requestPermission()}
                        paused={!visible}
                        onBarcode={(value) => {
                            if (busy.current) return;
                            busy.current = true;
                            onCapture(value.trim());
                            onClose();
                        }}
                    />
                </View>
            </View>
        </Modal>
    );
}
const s = StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(18,26,23,.55)' },
    sheet: {
        backgroundColor: '#F2F3F2',
        padding: 16,
        paddingBottom: 32,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 4,
        backgroundColor: '#D7DCDA',
        alignSelf: 'center',
        marginBottom: 18,
    },
    heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 20, fontWeight: '600', color: '#182021' },
    help: { fontSize: 14, lineHeight: 20, color: '#667085', marginVertical: 14 },
});
