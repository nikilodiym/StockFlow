/** Lock camera callbacks until a scan has finished; report only actual additions. */
import { useRef, useState } from 'react';
import { useCameraPermissions } from 'expo-camera';
import { useAddProduct } from '../../inventory/hooks/useAddProduct';
import { normalizeBarcode } from '../services/BarcodeService';
export function useBarcodeScanner() {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false),
        [found, setFound] = useState(false);
    const [lastCode, setLastCode] = useState('');
    const busy = useRef(false);
    const locked = useRef(false);
    const { find } = useAddProduct();
    const process = async (code: string) => {
        if (busy.current) return false;
        busy.current = true;
        locked.current = true;
        setScanned(true);
        setFound(false);
        try {
            const normalized = normalizeBarcode(code);
            setLastCode(normalized);
            const added = await find(normalized, 'scan');
            setFound(added);
            return added;
        } finally {
            busy.current = false;
        }
    };
    return {
        hasPermission: !!permission?.granted,
        requestPermission,
        scanned,
        found,
        lastCode,
        resetScan: () => {
            if (!busy.current) {
                locked.current = false;
                setScanned(false);
                setFound(false);
            }
        },
        onBarcode: (code: string) => {
            if (!locked.current) void process(code);
        },
        findManual: process,
    };
}
