/** Camera permission + "scanned" lock so one barcode is not added many times per second. */
import { useState } from 'react';
import { useCameraPermissions } from 'expo-camera';
import { useAddProduct } from '../../inventory/hooks/useAddProduct';
import { normalizeBarcode } from '../services/BarcodeService';

export function useBarcodeScanner() {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const { find } = useAddProduct();

    /** Camera callback: lock, look up, add. Press "scan again" to unlock. */
    const onBarcode = (data: string) => {
        setScanned(true);
        void find(normalizeBarcode(data), 'scan');
    };

    /** Manual entry on the scanner screen. */
    const findManual = (code: string) => find(code, 'scan');

    return {
        hasPermission: !!permission?.granted,
        requestPermission,
        scanned,
        resetScan: () => setScanned(false),
        onBarcode,
        findManual,
    };
}
